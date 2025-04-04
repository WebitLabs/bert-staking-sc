import { expect } from "chai";
import { prelude } from "./helpers/prelude";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  createAndProcessTransaction,
  getAddedAccountInfo,
} from "./helpers/bankrun";
import { BertStakingSDK } from "../sdk/src";
import { BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { USDC_MINT_ADDRESS } from "./helpers/constants";
import { createAtaForMint, getTokenBalance } from "./helpers/token";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";

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
  let programAuthorityPda: PublicKey;
  let programTokenAccount: PublicKey;
  const stakeAmount = 50_000; // 50k tokens
  const mintAmount = 1_000_000; // 1 million tokens

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
      lockTime,
      yieldRate,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });

    try {
      // Create and process the transaction
      await createAndProcessTransaction(client, authority, initializeIx);

      // Fetch the config account to verify initialization
      const configAccount = await sdk.fetchConfigByAddress(configPda);

      // Assert that all config values are set correctly
      expect(configAccount.authority).to.deep.equal(authority.publicKey);
      expect(configAccount.mint).to.deep.equal(tokenMint);
      expect(configAccount.lockTime.toString()).to.equal(lockTime.toString());
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
      console.log("Lock Time (days):", configAccount.lockTime.toString());
      console.log("Yield Rate (bps):", configAccount.yieldRate.toString());
      console.log("Max Cap:", configAccount.maxCap.toString());
      console.log(
        "NFT Value in Tokens:",
        configAccount.nftValueInTokens.toString()
      );
      console.log("NFTs Limit Per User:", configAccount.nftsLimitPerUser);
    } catch (err) {
      console.error("Failed to process initialize tx with err:", err);
      expect.fail("Failed to process initialize tx");
    }
  });

  it("Creates token mint and accounts for testing", async () => {
    // Get the program authority PDA
    [programAuthorityPda] = sdk.pda.findProgramAuthorityPda();

    try {
      const owner = payer.publicKey;
      const mint = tokenMint;

      createAtaForMint(provider, owner, mint);

      userTokenAccount = getAssociatedTokenAddressSync(mint, owner, true);

      programTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        programAuthorityPda,
        true
      );
    } catch (err) {
      console.error("Failed to set up token mint and accounts:", err);
      expect.fail("Token setup failed");
    }
  });

  it("Stakes tokens successfully", async () => {
    try {
      // Create position PDA
      const [positionPda] = sdk.pda.findPositionPda(payer.publicKey, tokenMint);
      console.log("Position PDA:", positionPda.toString());

      // Create stake token instruction
      const stakeTokenIx = await sdk.stakeToken({
        owner: payer.publicKey,
        tokenMint,
        amount: stakeAmount,
        tokenAccount: userTokenAccount,
        programTokenAccount: programTokenAccount,
      });

      // Process transaction
      await createAndProcessTransaction(client, payer, stakeTokenIx);

      // Verify staking results

      // 1. Check user's token balance decreased
      const userTokenAccountBalance = await getTokenBalance(
        client,
        userTokenAccount
      );

      const expectedRemainingBalance = mintAmount - stakeAmount;
      expect(userTokenAccountBalance).to.equal(expectedRemainingBalance);
      console.log("User token balance after staking:", userTokenAccountBalance);

      // 2. Check program's token balance increased
      const programTokenAccountBalance = await getTokenBalance(
        client,
        programTokenAccount
      );

      expect(programTokenAccountBalance).to.equal(stakeAmount);
      console.log(
        "Program token balance after staking:",
        programTokenAccountBalance
      );

      // 3. Check position account was created correctly
      const position = await sdk.fetchPosition(payer.publicKey, tokenMint);
      expect(position).to.not.be.null;
      expect(position.owner.toString()).to.equal(payer.publicKey.toString());
      expect(position.amount.toNumber()).to.equal(stakeAmount);
      expect(position.positionType).to.equal(1); // Token = 1
      expect(position.status).to.equal(0); // Unclaimed = 0

      console.log("Position created successfully:");
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
      const [configPda] = sdk.pda.findConfigPda(payer.publicKey);
      const configAccount = await sdk.fetchConfigByAddress(configPda);

      expect(configAccount.totalStakedAmount.toNumber()).to.equal(stakeAmount);
      console.log(
        "Total staked amount:",
        configAccount.totalStakedAmount.toString()
      );
    } catch (err) {
      console.error("Failed to stake tokens:", err);
      expect.fail("Token staking failed");
    }
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

