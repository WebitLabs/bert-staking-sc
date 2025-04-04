import { expect } from "chai";
import { prelude } from "./helpers/prelude";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  createAndProcessTransaction,
  getAddedAccountInfo,
} from "./helpers/bankrun";
import { BertStakingSDK, Config, LockPeriod } from "../sdk/src";
import { BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
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
  const lockTime = 7; // 7 days lock period
  const yieldRate = 500; // 5% in basis points
  const maxCap = 1_000_000_000; // 1 billion tokens
  const nftValueInTokens = 100_000; // 100k tokens per NFT
  const nftsLimitPerUser = 5; // 5 NFTs max per user

  // Token staking parameters
  let userTokenAccount: PublicKey;
  let programTokenAccount: PublicKey;

  let collection = PublicKey.default;
  let decimals: number;

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
      lockPeriod: LockPeriod.ThreeDays,
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

    // Assert that all config values are set correctly
    expect(configAccount.authority).to.deep.equal(authority.publicKey);
    expect(configAccount.mint).to.deep.equal(tokenMint);
    expect(configAccount.lockPeriod).to.deep.equal({ threeDays: {} });
    expect(configAccount.yieldRate.toString()).to.equal(yieldRate.toString());
    expect(configAccount.maxCap.toString()).to.equal(maxCap.toString());
    expect(configAccount.nftValueInTokens.toString()).to.equal(
      nftValueInTokens.toString()
    );
    expect(configAccount.nftsLimitPerUser).to.equal(nftsLimitPerUser);
    expect(configAccount.totalStakedAmount.toString()).to.equal("0");

    console.log(
      "Config initialized successfully with the following parameters:"
    );
    console.log("Lock Time (days):", configAccount.lockPeriod.toString());
    console.log("Yield Rate (bps):", configAccount.yieldRate.toString());
    console.log("Max Cap:", configAccount.maxCap.toString());
    console.log(
      "NFT Value in Tokens:",
      configAccount.nftValueInTokens.toString()
    );
    console.log("NFTs Limit Per User:", configAccount.nftsLimitPerUser);
  });

  it("Creates token mint and accounts for testing", async () => {
    try {
      const owner = payer.publicKey;
      const mint = tokenMint;

      const mintAmount = 1_000 * 10 ** decimals;
      createAtaForMint(provider, owner, mint, BigInt(mintAmount));

      userTokenAccount = getAssociatedTokenAddressSync(mint, owner, true);

      console.log(
        `User has ${await getTokenBalance(client, userTokenAccount)} USDC`
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
      const period = LockPeriod.ThreeDays;
      console.log("Position PDA:", positionPda.toString());

      // Step 1: Initialize position first
      console.log("Initializing position...");
      const initPositionIx = await sdk.initializePosition({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
      });

      // Process the initialize position transaction
      await createAndProcessTransaction(client, payer, initPositionIx);
      console.log("Position initialized successfully");

      // Verify the position was created with correct initial values
      let position = await sdk.fetchPosition(payer.publicKey, tokenMint);
      expect(position).to.not.be.null;
      expect(position.owner.toString()).to.equal(payer.publicKey.toString());
      expect(position.status).to.deep.equal({ unclaimed: {} }); // Unclaimed
      console.log("Initial position created with status:", position.status);

      // Step 2: Now stake tokens to the initialized position
      console.log("Staking tokens to the initialized position...");
      const stakeTokenIx = await sdk.stakeToken({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
        period,
        amount: stakeAmount,
        tokenAccount: userTokenAccount,
      });

      // Process the stake token transaction
      await createAndProcessTransaction(client, payer, stakeTokenIx);
      console.log("Tokens staked successfully");
    } catch (err) {
      console.error("Failed to initialize position or stake tokens:", err);
      expect.fail("Position initialization or token staking failed");
    }

    // Verify staking results

    // 1. Check user's token balance decreased
    const userTokenAccountBalance = await getTokenBalance(
      client,
      userTokenAccount
    );

    const expectedRemainingBalance = mintAmount - stakeAmount;
    expect(userTokenAccountBalance).to.equal(expectedRemainingBalance);
    console.log("User token balance after staking:", userTokenAccountBalance);

    const vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);

    // 2. Check program's token balance increased
    const vaultBalance = await getTokenBalance(client, vaultAta);

    expect(vaultBalance).to.equal(stakeAmount);
    console.log("Program token balance after staking:", vaultBalance);

    // 3. Check position account was updated correctly after staking
    const position = await sdk.fetchPosition(payer.publicKey, tokenMint);
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
      new Date(position.depositTime.toNumber() * 1000).toISOString()
    );
    console.log(
      "- Unlock time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );

    // 4. Check config total staked amount increased
    const configAccount = await sdk.fetchConfigByAddress(configPda);

    // expect(configAccount.totalStakedAmount.toNumber()).to.equal(stakeAmount);
    console.log(
      "Total staked amount:",
      configAccount.totalStakedAmount.toString()
    );
  });

  // it("Claims tokens after lock period", async () => {
  //   try {
  //     // Warp to the future when the position is unlocked
  //     // 7 days in seconds + some buffer
  //     const secondsToWarp = 7 * 24 * 60 * 60 + 60;
  //     await client.warpToSlot(
  //       (await client.getCurrentSlot()) + secondsToWarp * 2
  //     ); // Solana averages 2 slots per second
  //
  //     // Create position PDA
  //     const [positionPda] = sdk.pda.findPositionPda(payer.publicKey, tokenMint);
  //
  //     // Create claim position instruction
  //     const claimPositionIx = await sdk.claimPosition({
  //       owner: payer.publicKey,
  //       positionPda,
  //       tokenMint,
  //       tokenAccount: userTokenAccount,
  //       programTokenAccount: programTokenAccount,
  //     });
  //
  //     // Process transaction
  //     await createAndProcessTransaction(client, payer, claimPositionIx);
  //
  //     // Verify claiming results
  //
  //     // 1. Check user's token balance increased with yield
  //     const userTokenAccountInfo = await getAccount(
  //       provider.connection,
  //       userTokenAccount,
  //       "confirmed",
  //       TOKEN_PROGRAM_ID
  //     );
  //
  //     // Expected yield = amount * yield_rate / 10000
  //     const expectedYield = Math.floor(stakeAmount * (yieldRate / 10000));
  //     const expectedBalance =
  //       mintAmount - stakeAmount + stakeAmount + expectedYield;
  //
  //     expect(Number(userTokenAccountInfo.amount)).to.be.approximately(
  //       expectedBalance,
  //       1
  //     ); // Allow for rounding
  //     console.log(
  //       "User token balance after claiming:",
  //       userTokenAccountInfo.amount.toString()
  //     );
  //     console.log("Expected yield:", expectedYield);
  //
  //     // 2. Check program's token balance decreased to 0
  //     const programTokenAccountInfo = await getAccount(
  //       provider.connection,
  //       programTokenAccount,
  //       "confirmed",
  //       TOKEN_PROGRAM_ID
  //     );
  //
  //     expect(Number(programTokenAccountInfo.amount)).to.equal(0);
  //
  //     // 3. Check position account was updated
  //     const position = await sdk.fetchPosition(payer.publicKey, tokenMint);
  //     expect(position.status).to.equal(1); // Claimed = 1
  //
  //     // 4. Check config total staked amount decreased
  //     const [configPda] = sdk.pda.findConfigPda(payer.publicKey);
  //     const configAccount = await sdk.fetchConfigByAddress(configPda);
  //
  //     expect(configAccount.totalStakedAmount.toNumber()).to.equal(0);
  //     console.log(
  //       "Total staked amount after claiming:",
  //       configAccount.totalStakedAmount.toString()
  //     );
  //   } catch (err) {
  //     console.error("Failed to claim tokens:", err);
  //     expect.fail("Token claiming failed");
  //   }
  // });
});
