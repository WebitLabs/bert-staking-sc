import { expect } from "chai";
import { prelude } from "./helpers/prelude";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  advanceUnixTimeStamp,
  createAndProcessTransaction,
  getAddedAccountInfo,
} from "./helpers/bankrun";
import {
  BertStakingSDK,
  Config,
  LockPeriod,
  Position,
  PositionType,
} from "../sdk/src";
import { BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC_MINT_ADDRESS } from "./helpers/constants";
import {
  createAtaForMint,
  getMintDecimals,
  getTokenBalance,
} from "./helpers/token";

describe("bert-staking-sc", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;
  let provider: BankrunProvider;
  let sdk: BertStakingSDK;

  const tokenMint = new PublicKey(USDC_MINT_ADDRESS);

  // Test parameters for initialization
  const yieldRate = 500; // 5% in basis points
  const maxCap = 1_000_000_000; // 1 billion tokens
  const nftValueInTokens = 100_000; // 100k tokens per NFT
  const nftsLimitPerUser = 5; // 5 NFTs max per user

  // Token staking parameters
  let userTokenAccount: PublicKey;

  let collection = PublicKey.default;
  let decimals: number;

  let tokensInVault;

  before("before", async () => {
    const usdcMint = await getAddedAccountInfo(tokenMint);

    const {
      context: _context,
      payer: _payer,
      client: _client,
      provider: _provider,
    } = await prelude(undefined, [usdcMint]);

    context = _context;
    payer = _payer;
    client = _client;
    provider = _provider;

    sdk = new BertStakingSDK(provider);

    decimals = await getMintDecimals(client, tokenMint);
  });

  it("Initializes the Bert staking program", async () => {
    let authority = payer;
    console.log("Authority:", authority.publicKey.toString());

    const [configPda] = sdk.pda.findConfigPda(authority.publicKey);
    console.log("Config PDA:", configPda.toString());

    // Create the initialize instruction
    const initializeIx = await sdk.initialize({
      authority: authority.publicKey,
      mint: tokenMint,
      collection,
      yieldRate,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });

    let configAccount: Config;
    try {
      // Create and process the transaction
      await createAndProcessTransaction(client, authority, initializeIx);

      // Fetch the config account to verify initialization
      configAccount = await sdk.fetchConfigByAddress(configPda);
    } catch (err) {
      console.error("Failed to process initialize tx with err:", err);
      expect.fail("Failed to process initialize tx");
    }

    const lockPeriods = BertStakingSDK.getSupportedLockPeriods();
    const convertedLockPeriod = lockPeriods.map((p) =>
      BertStakingSDK.getLockPeriodFromIdl(p),
    );

    // Assert that all config values are set correctly
    expect(configAccount.authority).to.deep.equal(authority.publicKey);
    expect(configAccount.mint).to.deep.equal(tokenMint);
    expect(configAccount.lockPeriod).to.deep.equal(convertedLockPeriod);
    expect(configAccount.yieldRate.toString()).to.equal(yieldRate.toString());
    expect(configAccount.maxCap.toString()).to.equal(maxCap.toString());
    expect(configAccount.nftValueInTokens.toString()).to.equal(
      nftValueInTokens.toString(),
    );
    expect(configAccount.nftsLimitPerUser).to.equal(nftsLimitPerUser);
    expect(configAccount.totalStakedAmount.toString()).to.equal("0");

    console.log(
      "Config initialized successfully with the following parameters:",
    );
    console.log("Lock Time (days):", configAccount.lockPeriod.toString());
    console.log("Yield Rate (bps):", configAccount.yieldRate.toString());
    console.log("Max Cap:", configAccount.maxCap.toString());
    console.log(
      "NFT Value in Tokens:",
      configAccount.nftValueInTokens.toString(),
    );
    console.log("NFTs Limit Per User:", configAccount.nftsLimitPerUser);
  });

  it("Creates token mint and accounts for testing", async () => {
    try {
      const owner = payer.publicKey;
      const mint = tokenMint;

      const [configPda] = sdk.pda.findConfigPda(payer.publicKey);

      // Create the ATAs with some tokens for the user and the vault
      const mintAmount = 1_000 * 10 ** decimals;
      tokensInVault = mintAmount;
      createAtaForMint(provider, owner, mint, BigInt(mintAmount));
      createAtaForMint(provider, configPda, mint, BigInt(mintAmount));

      userTokenAccount = getAssociatedTokenAddressSync(mint, owner, true);

      console.log(
        `User has ${await getTokenBalance(client, userTokenAccount)} USDC`,
      );
    } catch (err) {
      console.error("Failed to set up token mint and accounts:", err);
      expect.fail("Token setup failed");
    }
  });

  it("Initializes a position and then stakes tokens successfully", async () => {
    const decimals = await getMintDecimals(client, tokenMint);

    const stakeAmount = 500 * 10 ** decimals; // 500 tokens
    const mintAmount = 1_000 * 10 ** decimals; // 1_000 previously minted tokens

    const [configPda] = sdk.pda.findConfigPda(payer.publicKey);

    try {
      // Create position PDA
      const [positionPda] = sdk.pda.findPositionPda(payer.publicKey, tokenMint);
      console.log("Position PDA:", positionPda.toString());

      // Step 1: Initialize position first
      console.log("Initializing position...");
      const initPositionIx = await sdk.initializePosition({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
        lockPeriod: LockPeriod.SevenDays,
        positionType: PositionType.Token,
      });

      // Process the initialize position transaction
      await createAndProcessTransaction(client, payer, initPositionIx);
      console.log("Position initialized successfully");
    } catch (err) {
      console.error("Failed to initialize position or stake tokens:", err);
      expect.fail("Position initialization or token staking failed");
    }

    // Verify the position was created with correct initial values
    let position = await sdk.fetchPosition(payer.publicKey, tokenMint);
    expect(position).to.not.be.null;
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
    expect(position.status).to.deep.equal({ unclaimed: {} }); // Unclaimed
    console.log("Initial position created with status:", position.status);

    try {
      // Step 2: Now stake tokens to the initialized position
      console.log("Staking tokens to the initialized position...");
      const stakeTokenIx = await sdk.stakeToken({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
        amount: stakeAmount,
        tokenAccount: userTokenAccount,
      });

      // Process the stake token transaction
      await createAndProcessTransaction(client, payer, stakeTokenIx);
      console.log("Tokens staked successfully");
    } catch (err) {
      console.error("Failed to stake tokens:", err);
      expect.fail("Staking failed");
    }

    // Verify staking results

    // 1. Check user's token balance decreased
    const userTokenAccountBalance = await getTokenBalance(
      client,
      userTokenAccount,
    );

    const expectedRemainingBalance = mintAmount - stakeAmount;
    expect(userTokenAccountBalance).to.equal(expectedRemainingBalance);
    console.log("User token balance after staking:", userTokenAccountBalance);

    const vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);

    // 2. Check program's token balance increased
    const vaultBalance = await getTokenBalance(client, vaultAta);

    expect(vaultBalance).to.equal(stakeAmount + tokensInVault);
    console.log("Program token balance after staking:", vaultBalance);

    // 3. Check position account was updated correctly after staking
    position = await sdk.fetchPosition(payer.publicKey, tokenMint);
    expect(position).to.not.be.null;
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
    expect(position.amount.toNumber()).to.equal(stakeAmount);
    expect(position.positionType).to.deep.equal({ token: {} }); // Token = 1
    expect(position.status).to.deep.equal({ unclaimed: {} }); // Unclaimed = 0

    console.log("Position updated successfully after staking:");
    console.log("- Owner:", position.owner.toString());
    console.log("- Amount:", position.amount.toString());
    console.log(
      "- Deposit time:",
      new Date(position.depositTime.toNumber() * 1000).toISOString(),
    );
    console.log(
      "- Unlock time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString(),
    );

    // 4. Check config total staked amount increased
    const configAccount = await sdk.fetchConfigByAddress(configPda);

    expect(configAccount.totalStakedAmount.toNumber()).to.equal(stakeAmount);
    console.log(
      "Total staked amount:",
      configAccount.totalStakedAmount.toString(),
    );
  });

  it("Claims tokens after lock period", async () => {
    let configPda: PublicKey;
    let configAccount: Config;
    let positionPda: PublicKey;
    let position: Position;
    let userBalanceBefore: number;
    let vaultBalanceBefore: number;
    let vaultAta: PublicKey;

    try {
      // First, let's fetch the position to confirm it exists and has correct data
      [positionPda] = sdk.pda.findPositionPda(payer.publicKey, tokenMint);
      position = await sdk.fetchPosition(payer.publicKey, tokenMint);

      console.log("Position before claiming:", {
        owner: position.owner.toString(),
        amount: position.amount.toString(),
        positionType: position.positionType,
        status: position.status,
        depositTime: new Date(
          position.depositTime.toNumber() * 1000,
        ).toISOString(),
        unlockTime: new Date(
          position.unlockTime.toNumber() * 1000,
        ).toISOString(),
      });

      // Warp to the future when the position is unlocked
      // 7 days in seconds + some buffer for SevenDays lock period
      const unlockTime = position.unlockTime.toNumber();
      const currentTime = Math.floor(Date.now() / 1000);

      // Calculate how many seconds we need to warp
      const secondsToWarp = unlockTime - currentTime + 60; // Add a buffer

      // Warp using the bankrun context
      advanceUnixTimeStamp(provider, BigInt(secondsToWarp));

      console.log(`Warped ${secondsToWarp} seconds into the future`);

      // Get config for vault and collection information
      [configPda] = sdk.pda.findConfigPda(payer.publicKey);
      configAccount = await sdk.fetchConfigByAddress(configPda);
      console.log("Config found:", configPda.toString());

      // Get the vault token account
      vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);
      console.log("Vault ATA:", vaultAta.toString());

      // Record balances before claiming
      vaultBalanceBefore = await getTokenBalance(client, vaultAta);
      userBalanceBefore = await getTokenBalance(client, userTokenAccount);
      console.log("Vault balance before:", vaultBalanceBefore);
      console.log("User balance before:", userBalanceBefore);

      const dummyNftMint = PublicKey.default;
      const dummyNftTokenAccount = PublicKey.default;

      // Create and send the claim position instruction
      const claimPositionIx = await sdk.claimPosition({
        authority: payer.publicKey, // The authority who initialized the config
        owner: payer.publicKey, // The owner of the position
        positionPda, // The position PDA to claim
        tokenMint, // The token mint (USDC in this case)
        nftMint: dummyNftMint, // Dummy NFT mint (not used for token position)
        tokenAccount: userTokenAccount, // User's token account to receive tokens
        nftTokenAccount: dummyNftTokenAccount, // Dummy NFT token account
        vault: vaultAta, // Program vault for tokens
        collection: configAccount.collection, // NFT collection (required by instruction)
        nftsVault: configAccount.nftsVault, // NFT vault (required by instruction)
      });

      console.log("Claim position instruction created, sending transaction...");
      await createAndProcessTransaction(client, payer, claimPositionIx);
      console.log("Transaction processed successfully");
    } catch (err) {
      console.error("Failed to claim tokens:", err);
      expect.fail(`Token claiming failed: ${err}`);
    }

    // Verify the results of claiming

    // 1. Check user's token balance increased with yield
    const userTokenBalance = await getTokenBalance(client, userTokenAccount);

    // Expected yield = staked amount * yield_rate / 10000
    const stakeAmount = position.amount.toNumber();
    const yieldAmount = Math.floor(stakeAmount * (yieldRate / 10000));
    const expectedFinalAmount = stakeAmount + yieldAmount;
    const expectedBalance = userBalanceBefore + expectedFinalAmount;

    console.log("User balance after:", userTokenBalance);
    console.log("Expected final amount:", expectedFinalAmount);
    console.log("Expected balance after:", expectedBalance);

    expect(userTokenBalance).to.be.approximately(expectedBalance, 2); // Allow small rounding differences

    // 2. Check program's token vault balance decreased
    const vaultBalance = await getTokenBalance(client, vaultAta);
    expect(vaultBalance).to.equal(vaultBalanceBefore - expectedFinalAmount);
    console.log("Vault balance after:", vaultBalance);

    // 3. Check position account was updated to claimed status
    const positionAfter = await sdk.fetchPosition(payer.publicKey, tokenMint);
    expect(positionAfter.status).to.deep.equal({ claimed: {} });
    console.log("Position status after claiming:", positionAfter.status);

    // 4. Check config's total staked amount was decreased
    const configAfter = await sdk.fetchConfigByAddress(configPda);
    expect(configAfter.totalStakedAmount.toNumber()).to.equal(
      configAccount.totalStakedAmount.toNumber() - stakeAmount,
    );
    console.log(
      "Total staked amount after claiming:",
      configAfter.totalStakedAmount.toString(),
    );

    console.log("Claim position test completed successfully");
  });
});
