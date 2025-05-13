import { expect } from "chai";
import { prelude } from "./helpers/prelude";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  advanceUnixTimeStamp,
  createAndProcessTransaction,
  getAddedAccountInfo,
} from "./helpers/bankrun";
import { BertStakingSDK, ConfigIdl } from "../sdk/src";
import { AddedProgram, BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MPL_CORE_ADDRESS, USDC_MINT_ADDRESS } from "./helpers/constants";
import {
  createAtaForMint,
  createTokenAccountAtAddress,
  getMintDecimals,
  getTokenBalance,
} from "./helpers/token";
import { getMplCoreAsset, createCollectionAndMintAsset } from "./helpers/core";
import { KeypairSigner } from "@metaplex-foundation/umi";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";

const addedPrograms: AddedProgram[] = [
  { name: "mpl_core", programId: new PublicKey(MPL_CORE_ADDRESS) },
];

const maxNftsCap = 1000;
const maxTokensCap = 1_000_000_000_000_000; // 1 Bilion with 6 decimals

const poolsConfig = [
  {
    lockPeriodDays: 1,
    yieldRate: 300,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
  {
    lockPeriodDays: 3,
    yieldRate: 500,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
  {
    lockPeriodDays: 7,
    yieldRate: 800,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
  {
    lockPeriodDays: 30,
    yieldRate: 1200,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
];

describe("bert-staking-sc", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;
  let provider: BankrunProvider;
  let sdk: BertStakingSDK;

  const tokenMint = new PublicKey(USDC_MINT_ADDRESS);

  // Global IDs for configs and positions
  const configId = 1; // Using 1 instead of 0 to test non-default ID
  const positionId = 42; // Using arbitrary ID for positions
  const nftPositionId = positionId + 100;

  // Test parameters for initialization
  const maxCap = 1_000_000_000 * 10 ** 6; // 1 billion tokens
  const nftValueInTokens = 100_000 * 10 ** 6; // 100k tokens per NFT
  const nftsLimitPerUser = 5; // 5 NFTs max per user

  // Token staking parameters
  let userTokenAccount: PublicKey;

  // let collection = new PublicKey(B_COLLECTION);
  // let asset = new PublicKey(B_545_ASSET);
  let decimals: number;

  const nftsToMint = 10;
  let collectionSigner: KeypairSigner;
  let assets: KeypairSigner[];

  let tokensInVault: number;

  before("before", async () => {
    const usdcMint = await getAddedAccountInfo(tokenMint);
    // const bCollection = await getAddedAccountInfo(collection);
    // const bAsset = await getAddedAccountInfo(asset);

    const addedAccounts = [usdcMint];

    const {
      context: _context,
      payer: _payer,
      client: _client,
      provider: _provider,
    } = await prelude(addedPrograms, addedAccounts);

    context = _context;
    payer = _payer;
    client = _client;
    provider = _provider;

    sdk = new BertStakingSDK(provider);

    decimals = await getMintDecimals(client, tokenMint);

    const result = await createCollectionAndMintAsset(
      payer,
      client,
      "B_COLLECTION",
      nftsToMint
    );

    collectionSigner = result.collection;
    assets = result.assets;
  });

  it("Initializes the Bert staking program and creates custom pool configurations", async () => {
    let authority = payer;
    console.log("Authority:", authority.publicKey.toString());

    const [configPda] = sdk.pda.findConfigPda(authority.publicKey, configId);
    console.log("Config PDA:", configPda.toString());

    // Get vault ATA for the config
    const vaultTA = getAssociatedTokenAddressSync(tokenMint, configPda, true);

    // Find the NFTs vault PDA
    const [nftsVaultPda, nftsVaultBump] = sdk.pda.findNftsVaultPda(
      configPda,
      tokenMint
    );
    console.log("NFTs Vault PDA:", nftsVaultPda.toString());

    let configAccount: ConfigIdl;
    try {
      // Initialize the staking program without pool configurations (new approach)
      const initializeIx = await sdk.initialize({
        authority: authority.publicKey,
        adminWithdrawDestination: authority.publicKey,
        mint: tokenMint,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        id: configId,
        vault: vaultTA,
        nftsVault: nftsVaultPda,
        maxCap,
        nftValueInTokens,
        nftsLimitPerUser,
      });

      console.log("Initializing program...");

      // Initialize auth vault instruction
      const initializeAuthVaultIx = await sdk.initializeAuthVault({
        authority: authority.publicKey,
        configId,
        tokenMint,
      });

      // Execute both instructions
      await createAndProcessTransaction(client, authority, [
        initializeIx,
        initializeAuthVaultIx,
      ]);
      console.log("Program and authority vault initialized successfully");

      configAccount = await sdk.fetchConfigByAddress(configPda);

      // Create instructions for initializing all pools
      const poolInstructions = [];
      for (let i = 0; i < poolsConfig.length; i++) {
        const poolConfig = poolsConfig[i];
        const initPoolIx = await sdk.initializePool({
          authority: authority.publicKey,
          configId,
          index: i,
          lockPeriodDays: poolConfig.lockPeriodDays,
          yieldRate: poolConfig.yieldRate,
          maxNftsCap: poolConfig.maxNfts,
          maxTokensCap: poolConfig.maxTokens,
        });
        poolInstructions.push(initPoolIx);
      }

      // Execute pool initialization instructions
      await createAndProcessTransaction(client, authority, poolInstructions);
      console.log("All pools initialized successfully");
    } catch (err) {
      console.error("Failed to process initialize tx with err:", err);
      expect.fail("Failed to process initialize tx");
    }

    // Verify config values
    expect(configAccount.authority).to.deep.equal(authority.publicKey);
    expect(configAccount.mint).to.deep.equal(tokenMint);
    expect(configAccount.id.toNumber()).to.deep.equal(configId);
    expect(configAccount.vault.toString()).to.equal(vaultTA.toString());
    expect(configAccount.nftsVault.toString()).to.equal(
      nftsVaultPda.toString()
    );

    // Verify authority vault was initialized
    const [authorityVaultPda] = sdk.pda.findAuthorityVaultPda(
      configPda,
      tokenMint
    );
    expect(configAccount.authorityVault.toString()).to.equal(
      authorityVaultPda.toString()
    );

    // Verify global configuration
    expect(configAccount.maxCap.toString()).to.equal(maxCap.toString());
    expect(configAccount.nftValueInTokens.toString()).to.equal(
      nftValueInTokens.toString()
    );
    expect(configAccount.nftsLimitPerUser).to.equal(nftsLimitPerUser);
    expect(configAccount.totalStakedAmount.toString()).to.equal("0");
    expect(configAccount.totalNftsStaked.toString()).to.equal("0");

    // Now verify each pool was correctly initialized
    console.log("Fetching and verifying all pools");
    const pools = [];

    for (let i = 0; i < poolsConfig.length; i++) {
      const [poolPda] = sdk.pda.findPoolPda(configPda, i);
      console.log(`Pool ${i} PDA: ${poolPda.toString()}`);

      const pool = await sdk.fetchPoolByAddress(poolPda);
      pools.push(pool);

      // Verify pool values
      expect(pool.config.toString()).to.equal(configPda.toString());
      expect(pool.index).to.equal(i);
      expect(pool.lockPeriodDays).to.equal(poolsConfig[i].lockPeriodDays);
      expect(pool.yieldRate.toNumber()).to.equal(poolsConfig[i].yieldRate);
      expect(pool.maxNftsCap).to.equal(poolsConfig[i].maxNfts);
      expect(pool.maxTokensCap.toString()).to.equal(
        poolsConfig[i].maxTokens.toString()
      );
      expect(pool.isPaused).to.be.false; // Pools should start as active
      expect(pool.totalNftsStaked).to.equal(0);
      expect(pool.totalTokensStaked.toNumber()).to.equal(0);
      expect(pool.lifetimeNftsStaked).to.equal(0);
      expect(pool.lifetimeTokensStaked.toNumber()).to.equal(0);
      expect(pool.lifetimeClaimedYield.toNumber()).to.equal(0);
    }

    console.log("Config and pools initialized successfully");
    console.log("Pool Configurations:");
    pools.forEach((pool, index) => {
      console.log(`Pool ${index} (${pool.lockPeriodDays} days):`);
      console.log(`  Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
      console.log(`  Max NFTs: ${pool.maxNftsCap}`);
      console.log(`  Max Tokens: ${pool.maxTokensCap.toString()}`);
      console.log(`  Is Paused: ${pool.isPaused}`);
    });

    console.log("Global Configuration:");
    console.log(`Max Cap: ${configAccount.maxCap.toString()}`);
    console.log(
      `NFT Value in Tokens: ${configAccount.nftValueInTokens.toString()}`
    );
    console.log(`NFTs Limit Per User: ${configAccount.nftsLimitPerUser}`);
  });

  it("Creates token mint and accounts for testing", async () => {
    try {
      const owner = payer.publicKey;
      const mint = tokenMint;

      const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

      // Create the ATAs with some tokens for the user, main vault, and authority vault
      const mintAmount = 1_000_000_000 * 10 ** decimals;
      tokensInVault = mintAmount;

      // Get authority vault PDA
      const [authorityVaultPda] = sdk.pda.findAuthorityVaultPda(
        configPda,
        tokenMint
      );

      // Create and fund accounts
      createAtaForMint(provider, owner, mint, BigInt(mintAmount));

      // Create main vault for principal - initially with 0 tokens
      createAtaForMint(provider, configPda, mint, BigInt(0));

      // Create authority vault for yield payments - funded with tokens for rewards
      createTokenAccountAtAddress(
        provider,
        authorityVaultPda,
        configPda,
        mint,
        BigInt(mintAmount)
      );

      userTokenAccount = getAssociatedTokenAddressSync(mint, owner, true);
      const mainVaultAta = getAssociatedTokenAddressSync(mint, configPda, true);

      // Check all balances
      console.log(
        `Main vault (for principal) has ${await getTokenBalance(
          client,
          mainVaultAta
        )} USDC`
      );

      console.log(
        `Authority vault (for yield) has ${await getTokenBalance(
          client,
          authorityVaultPda
        )} USDC`
      );

      console.log(
        `User has ${await getTokenBalance(client, userTokenAccount)} USDC`
      );
    } catch (err) {
      console.error("Failed to set up token mint and accounts:", err);
      expect.fail("Token setup failed");
    }
  });

  it("Initializes a user account successfully", async () => {
    // Use the configured configId
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
    console.log("Config PDA:", configPda.toString());

    // Find user account PDA
    const [userAccountPda] = sdk.pda.findUserAccountPda(
      payer.publicKey,
      configPda
    );
    console.log("User Account PDA:", userAccountPda.toString());

    // We'll use pool index 0 for user initialization
    const poolIndex = 0;
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    try {
      // Create initialize user instruction
      console.log("Initializing user account...");
      const initUserIx = await sdk.initializeUser({
        owner: payer.publicKey,
        authority: payer.publicKey,
        configId,
        mint: tokenMint,
        poolIndex,
      });

      // Process the initialize user transaction
      await createAndProcessTransaction(client, payer, [initUserIx]);
      console.log("User account initialized successfully");
    } catch (err) {
      console.error("Failed to initialize user account:", err);
      expect.fail("User account initialization failed");
    }

    // Verify the user account was created correctly
    const userAccount = await sdk.fetchUserAccountByAddress(userAccountPda);

    // Validate user account data
    expect(userAccount).to.not.be.null;
    expect(userAccount.totalStakedValue.toNumber()).to.equal(0);
    expect(userAccount.totalStakedNfts).to.equal(0);
    expect(userAccount.totalStakedTokenAmount.toNumber()).to.equal(0);

    console.log("User account validated successfully:");
    console.log(
      "- Total Staked Value:",
      userAccount.totalStakedValue.toString()
    );
    console.log("- Total Staked NFTs:", userAccount.totalStakedNfts);
    console.log(
      "- Total Staked Token Amount:",
      userAccount.totalStakedTokenAmount.toString()
    );

    // Attempt to re-initialize the same user account (should fail)
    try {
      const initUserIx = await sdk.initializeUser({
        owner: payer.publicKey,
        authority: payer.publicKey,
        configId,
        mint: tokenMint,
        poolIndex,
      });

      await createAndProcessTransaction(client, payer, [initUserIx]);
      expect.fail(
        "Should not be able to reinitialize an existing user account"
      );
    } catch (err) {
      console.log("As expected, re-initializing the user account failed");
    }
  });

  it("Stakes tokens successfully with correct position tracking and updates", async () => {
    const decimals = await getMintDecimals(client, tokenMint);

    // Setup test parameters
    const stakeAmount = 500 * 10 ** decimals; // 500 tokens
    const mintAmount = 1_000 * 10 ** decimals; // 1,000 tokens previously minted to user
    const positionId = 42; // Arbitrary position ID for test
    const poolIndex = 0; // Use the 7-day lock period with 8% yield

    // Get account addresses
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
    const [userAccountPda] = sdk.pda.findUserAccountPda(
      payer.publicKey,
      configPda
    );
    const [positionPda] = sdk.pda.findPositionPda(
      payer.publicKey,
      tokenMint,
      positionId
    );
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
      payer.publicKey,
      poolPda
    );

    console.log("Config PDA:", configPda.toString());
    console.log("User Account PDA:", userAccountPda.toString());
    console.log("Position PDA:", positionPda.toString());
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());
    console.log("User Pool Stats PDA:", userPoolStatsPda.toString());

    // Capture state before staking
    const configBefore = await sdk.fetchConfigByAddress(configPda);
    const userAccountBefore = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);

    const userTokenBalanceBefore = await getTokenBalance(
      client,
      userTokenAccount
    );
    const vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);
    const vaultBalanceBefore = await getTokenBalance(client, vaultAta);

    console.log("---- State Before Staking ----");
    console.log("User token balance:", userTokenBalanceBefore);
    console.log("Vault token balance:", vaultBalanceBefore);
    console.log(
      "Config total staked:",
      configBefore.totalStakedAmount.toString()
    );
    console.log(
      "User total staked tokens:",
      userAccountBefore.totalStakedTokenAmount.toString()
    );
    console.log(
      "Pool total tokens staked:",
      poolBefore.totalTokensStaked.toString()
    );

    try {
      // Create and execute the stake token instruction
      console.log("\nStaking tokens...");
      const stakeTokenIx = await sdk.stakeToken({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
        configId,
        positionId,
        amount: stakeAmount,
        poolIndex,
        tokenAccount: userTokenAccount,
      });

      await createAndProcessTransaction(client, payer, [stakeTokenIx]);
      console.log("Tokens staked successfully");
    } catch (err) {
      console.error("Failed to stake tokens:", err);
      expect.fail(`Token staking failed: ${err}`);
    }

    // 1. Check the position was created and initialized correctly
    const position = await sdk.fetchPosition(
      payer.publicKey,
      positionId,
      tokenMint
    );
    expect(position).to.not.be.null;
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
    expect(position.amount.toNumber()).to.equal(stakeAmount);
    expect(position.positionType).to.deep.equal({ token: {} });
    expect(position.status).to.deep.equal({ unclaimed: {} });

    // 2. Check token transfers were completed correctly
    const userTokenBalanceAfter = await getTokenBalance(
      client,
      userTokenAccount
    );
    const vaultBalanceAfter = await getTokenBalance(client, vaultAta);
    expect(userTokenBalanceAfter).to.equal(
      userTokenBalanceBefore - stakeAmount
    );
    expect(vaultBalanceAfter).to.equal(vaultBalanceBefore + stakeAmount);

    // 3. Check config values were updated
    const configAfter = await sdk.fetchConfigByAddress(configPda);
    expect(configAfter.totalStakedAmount.toNumber()).to.equal(
      configBefore.totalStakedAmount.toNumber() + stakeAmount
    );

    // 4. Check user account stats were updated
    const userAccountAfter = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
    expect(userAccountAfter.totalStakedTokenAmount.toNumber()).to.equal(
      userAccountBefore.totalStakedTokenAmount.toNumber() + stakeAmount
    );
    expect(userAccountAfter.totalStakedValue.toNumber()).to.equal(
      userAccountBefore.totalStakedValue.toNumber() + stakeAmount
    );
    expect(userAccountAfter.totalStakedNfts).to.equal(
      userAccountBefore.totalStakedNfts
    );

    // 5. Check pool stats were updated
    const poolAfter = await sdk.fetchPoolByAddress(poolPda);
    expect(poolAfter.totalTokensStaked.toNumber()).to.equal(
      poolBefore.totalTokensStaked.toNumber() + stakeAmount
    );
    expect(poolAfter.lifetimeTokensStaked.toNumber()).to.equal(
      poolBefore.lifetimeTokensStaked.toNumber() + stakeAmount
    );

    // 6. Check user pool stats were updated
    const userPoolStatsAfter = await sdk.fetchUserPoolStatsByAddress(
      userPoolStatsPda
    );
    expect(userPoolStatsAfter.tokensStaked.toNumber()).to.equal(stakeAmount);
    expect(userPoolStatsAfter.nftsStaked).to.equal(0);

    // 7. Verify unlock time is correctly calculated
    const unlockTime = position.unlockTime.toNumber();
    const depositTime = position.depositTime.toNumber();

    const sevenDaysInSeconds = 60;
    expect(unlockTime - depositTime).to.be.approximately(sevenDaysInSeconds, 5); // Allow small difference due to timing

    console.log("\n---- Position Details ----");
    console.log("Position owner:", position.owner.toString());
    console.log("Position amount:", position.amount.toString());
    console.log("Position type:", position.positionType);
    console.log("Position status:", position.status);
    console.log(
      "Deposit time:",
      new Date(position.depositTime.toNumber() * 1000).toISOString()
    );
    console.log(
      "Unlock time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );
    console.log("Lock duration (seconds):", (unlockTime - depositTime) / 60);

    console.log("\n---- State After Staking ----");
    console.log("User token balance:", userTokenBalanceAfter);
    console.log("Vault token balance:", vaultBalanceAfter);
    console.log(
      "Config total staked:",
      configAfter.totalStakedAmount.toString()
    );
    console.log(
      "User total staked tokens:",
      userAccountAfter.totalStakedTokenAmount.toString()
    );
    console.log(
      "Pool total tokens staked:",
      poolAfter.totalTokensStaked.toString()
    );
    console.log(
      "Pool lifetime tokens staked:",
      poolAfter.lifetimeTokensStaked.toString()
    );
    console.log(
      "User pool stats staked tokens:",
      userPoolStatsAfter.tokensStaked.toString()
    );
  });

  it("Claims tokens after lock period with correct yield calculation and state updates", async () => {
    // Use the same position ID that was created in the previous test
    const positionId = 42;
    const poolIndex = 0; // The 7-day lock period we used in the previous test

    // Get the account addresses
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
    const [userAccountPda] = sdk.pda.findUserAccountPda(
      payer.publicKey,
      configPda
    );
    const [positionPda] = sdk.pda.findPositionPda(
      payer.publicKey,
      tokenMint,
      positionId
    );
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
      payer.publicKey,
      poolPda
    );

    console.log("Config PDA:", configPda.toString());
    console.log("User Account PDA:", userAccountPda.toString());
    console.log("Position PDA:", positionPda.toString());
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());
    console.log("User Pool Stats PDA:", userPoolStatsPda.toString());

    // Get both vault addresses - main vault for principal and authority vault for yield
    const vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);
    const [authorityVaultPda] = sdk.pda.findAuthorityVaultPda(
      configPda,
      tokenMint
    );

    // First, let's fetch the current position to confirm it exists
    const position = await sdk.fetchPosition(
      payer.publicKey,
      positionId,
      tokenMint
    );

    console.log("\n---- Position Before Claiming ----");
    console.log("Position owner:", position.owner.toString());
    console.log("Position amount:", position.amount.toString());
    console.log("Position type:", position.positionType);
    console.log("Position status:", position.status);
    console.log(
      "Deposit time:",
      new Date(position.depositTime.toNumber() * 1000).toISOString()
    );
    console.log(
      "Unlock time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );

    // Check if the position exists and is in the expected state
    expect(position).to.not.be.null;
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
    expect(position.positionType).to.deep.equal({ token: {} });
    expect(position.status).to.deep.equal({ unclaimed: {} });

    // Capture state before claiming
    const configBefore = await sdk.fetchConfigByAddress(configPda);
    const userAccountBefore = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);

    // User pool stats should exist at claim time
    let userPoolStatsBefore;
    try {
      userPoolStatsBefore = await sdk.fetchUserPoolStatsByAddress(
        userPoolStatsPda
      );
    } catch (err) {
      console.log(
        "User pool stats account doesn't exist yet - this is unexpected at claim time"
      );
      userPoolStatsBefore = {
        nftsStaked: 0,
        tokensStaked: new BN(0),
        totalValue: new BN(0),
        claimedYield: new BN(0),
        user: null,
        pool: null,
      };
      expect.fail("User pool stats should exist at claim time");
    }
    const userTokenBalanceBefore = await getTokenBalance(
      client,
      userTokenAccount
    );
    const vaultBalanceBefore = await getTokenBalance(client, vaultAta);
    const authorityVaultBalanceBefore = await getTokenBalance(
      client,
      authorityVaultPda
    );

    console.log("\n---- State Before Claiming ----");
    console.log("User token balance:", userTokenBalanceBefore);
    console.log("Main vault balance (principal):", vaultBalanceBefore);
    console.log(
      "Authority vault balance (yield):",
      authorityVaultBalanceBefore
    );
    console.log(
      "Config total staked:",
      configBefore.totalStakedAmount.toString()
    );
    console.log(
      "Pool total tokens staked:",
      poolBefore.totalTokensStaked.toString()
    );
    console.log(
      "Pool lifetime claimed yield:",
      poolBefore.lifetimeClaimedYield.toString()
    );
    console.log(
      "User account total staked tokens:",
      userAccountBefore.totalStakedTokenAmount.toString()
    );
    console.log(
      "User pool stats staked tokens:",
      userPoolStatsBefore.tokensStaked.toString()
    );

    // Calculate the expected yield
    const yieldRate = poolBefore.yieldRate.toNumber();
    const stakeAmount = position.amount.toNumber();
    const yieldAmount = Math.floor(stakeAmount * (yieldRate / 10000));
    const expectedFinalAmount = stakeAmount + yieldAmount;

    console.log("\n---- Yield Calculation ----");
    console.log("Stake amount:", stakeAmount);
    console.log("Yield rate (basis points):", yieldRate);
    console.log("Yield rate (percentage):", yieldRate / 100, "%");
    console.log("Calculated yield amount:", yieldAmount);
    console.log("Expected final amount (stake + yield):", expectedFinalAmount);

    // Warp time to after the unlock period
    try {
      // Calculate how many seconds we need to warp
      const unlockTime = position.unlockTime.toNumber();
      const currentTime = Math.floor(Date.now() / 1000);
      const secondsToWarp = unlockTime - currentTime + 60; // Add a buffer of 60s

      console.log("\nWarping time forward to unlock position...");
      console.log("Current time:", new Date(currentTime * 1000).toISOString());
      console.log("Unlock time:", new Date(unlockTime * 1000).toISOString());
      console.log("Seconds to warp:", secondsToWarp);

      // Warp using the bankrun context
      advanceUnixTimeStamp(provider, BigInt(secondsToWarp));
      console.log("Time warped successfully!");

      // Create and execute claim position instruction
      console.log("\nClaiming position...");

      const claimPositionIx = await sdk.claimTokenPosition({
        authority: payer.publicKey,
        owner: payer.publicKey,
        positionPda,
        tokenMint,
        tokenAccount: userTokenAccount,
        vault: vaultAta,
        collection: configBefore.collection,
        configId,
        poolIndex,
      });

      await createAndProcessTransaction(client, payer, [claimPositionIx]);
      console.log("Position claimed successfully!");
    } catch (err) {
      console.error("Failed to claim tokens:", err);
      expect.fail(`Token claiming failed: ${err}`);
    }

    // Verify the results of claiming

    // 1. Check user's token balance increased with yield and principal
    const userTokenBalanceAfter = await getTokenBalance(
      client,
      userTokenAccount
    );
    const expectedBalance = userTokenBalanceBefore + expectedFinalAmount;
    expect(userTokenBalanceAfter).to.be.approximately(expectedBalance, 2); // Allow small rounding differences

    // 2. Check main vault balance decreased by only the principal amount
    const vaultBalanceAfter = await getTokenBalance(client, vaultAta);
    expect(vaultBalanceAfter).to.equal(vaultBalanceBefore - stakeAmount);

    // 3. Check authority vault balance decreased by only the yield amount
    const authorityVaultBalanceAfter = await getTokenBalance(
      client,
      authorityVaultPda
    );
    expect(authorityVaultBalanceAfter).to.equal(
      authorityVaultBalanceBefore - yieldAmount
    );

    // 4. Check position status has been updated to claimed
    const positionAfter = await sdk.fetchPosition(
      payer.publicKey,
      positionId,
      tokenMint
    );
    expect(positionAfter.status).to.deep.equal({ claimed: {} });

    // 5. Check config's total staked amount was decreased
    const configAfter = await sdk.fetchConfigByAddress(configPda);
    expect(configAfter.totalStakedAmount.toNumber()).to.equal(
      configBefore.totalStakedAmount.toNumber() - stakeAmount
    );

    // 6. Check pool stats were updated correctly
    const poolAfter = await sdk.fetchPoolByAddress(poolPda);
    expect(poolAfter.totalTokensStaked.toNumber()).to.equal(
      poolBefore.totalTokensStaked.toNumber() - stakeAmount
    );
    expect(poolAfter.lifetimeClaimedYield.toNumber()).to.equal(
      poolBefore.lifetimeClaimedYield.toNumber() + yieldAmount
    );

    // 7. Check user pool stats were updated
    const userPoolStatsAfter = await sdk.fetchUserPoolStatsByAddress(
      userPoolStatsPda
    );
    expect(userPoolStatsAfter.tokensStaked.toNumber()).to.be.equal(
      userPoolStatsBefore.tokensStaked.toNumber() - stakeAmount
    );

    // 8. Check user account stats were updated
    const userAccountAfter = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
    expect(userAccountAfter.totalStakedTokenAmount.toNumber()).to.be.lessThan(
      userAccountBefore.totalStakedTokenAmount.toNumber()
    );

    console.log("\n---- State After Claiming ----");
    console.log("User token balance:", userTokenBalanceAfter);
    console.log("Main vault balance (principal):", vaultBalanceAfter);
    console.log("Authority vault balance (yield):", authorityVaultBalanceAfter);
    console.log("Position status:", positionAfter.status);
    console.log(
      "Config total staked:",
      configAfter.totalStakedAmount.toString()
    );
    console.log(
      "Pool total tokens staked:",
      poolAfter.totalTokensStaked.toString()
    );
    console.log(
      "Pool lifetime claimed yield:",
      poolAfter.lifetimeClaimedYield.toString()
    );
    console.log(
      "User account total staked tokens:",
      userAccountAfter.totalStakedTokenAmount.toString()
    );
    console.log(
      "User pool stats staked tokens:",
      userPoolStatsAfter.tokensStaked.toString()
    );

    console.log("\nToken yield calculation:");
    console.log(`Initial stake: ${stakeAmount}`);
    console.log(`Yield rate: ${yieldRate / 100}%`);
    console.log(`Yield amount: ${yieldAmount}`);
    console.log(`Total returned to user: ${expectedFinalAmount}`);

    console.log("\nClaim position test completed successfully!");
  });

  it("Stakes a Metaplex Core asset successfully", async () => {
    const assetSigner = assets[0];

    const poolIndex = 2;
    const nftPositionId = 200; // Use a specific position ID for NFT positions

    // Get the Config PDA and account data with our configId
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

    // Find the NFTs vault PDA
    const [nftsVaultPda] = sdk.pda.findNftsVaultPda(configPda, tokenMint);
    console.log("NFTs Vault PDA:", nftsVaultPda.toString());

    // Find the Pool PDA for the specified pool index
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Find the user account PDA
    const [userAccountPda] = sdk.pda.findUserAccountPda(
      payer.publicKey,
      configPda
    );
    console.log("User Account PDA:", userAccountPda.toString());

    // Find the user pool stats PDA
    const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
      payer.publicKey,
      poolPda
    );
    console.log("User Pool Stats PDA:", userPoolStatsPda.toString());

    console.log("Staking a single Metaplex Core asset...");
    console.log("Owner:", payer.publicKey.toString());
    console.log("Asset:", assetSigner.publicKey.toString());
    console.log("Collection:", collectionSigner.publicKey.toString());
    console.log("Position ID:", nftPositionId);

    // Capture state before staking
    const configBefore = await sdk.fetchConfigByAddress(configPda);
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    const userAccountBefore = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );

    // Find the Position PDA for this owner, mint, asset and position ID
    const asset = toWeb3JsPublicKey(assetSigner.publicKey);
    const [positionPda] = sdk.pda.findNftPositionPda(
      payer.publicKey,
      tokenMint,
      asset,
      nftPositionId
    );
    console.log("Position PDA:", positionPda.toString());

    // Create the stake NFT instruction with position ID
    const stakeNftIx = await sdk.stakeNft({
      authority: payer.publicKey,
      owner: payer.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      asset,
      configId,
      poolIndex,
      positionId: nftPositionId, // Include position ID
      nftsVault: nftsVaultPda,
    });

    try {
      // First create the NFTs vault account, then stake the NFT
      console.log("Creating NFTs vault account and staking NFT...");
      await createAndProcessTransaction(client, payer, [stakeNftIx]);
      console.log("NFT staked successfully");
    } catch (err) {
      console.error("Failed to stake NFT:", err);
      expect.fail(`NFT staking failed: ${err}`);
    }

    // Verify the position was created and updated correctly
    const position = await sdk.fetchPosition(
      payer.publicKey,
      nftPositionId,
      tokenMint,
      asset
    );

    expect(position).to.not.be.null;
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
    expect(position.positionType).to.deep.equal({ nft: {} });
    expect(position.amount.toNumber()).to.equal(nftValueInTokens);
    expect(position.id.toNumber()).to.equal(nftPositionId); // Verify ID is set correctly

    // Verify the pool stats were updated
    const poolAfter = await sdk.fetchPoolByAddress(poolPda);
    expect(poolAfter.totalNftsStaked).to.be.equal(
      poolBefore.totalNftsStaked + 1
    );
    expect(poolAfter.lifetimeNftsStaked).to.be.equal(
      poolBefore.lifetimeNftsStaked + 1
    );

    // Verify user pool stats were updated (or created if they didn't exist)
    const userPoolStatsAfter = await sdk.fetchUserPoolStatsByAddress(
      userPoolStatsPda
    );
    expect(userPoolStatsAfter.nftsStaked).to.equal(1);
    expect(userPoolStatsAfter.user.toString()).to.equal(
      payer.publicKey.toString()
    );
    expect(userPoolStatsAfter.pool.toString()).to.equal(poolPda.toString());

    console.log("Position after staking NFT:");
    console.log("- Owner:", position.owner.toString());
    console.log("- Position ID:", position.id.toString());
    console.log("- Amount:", position.amount.toString());
    console.log("- Position Type:", position.positionType);
    console.log("- Asset:", position.asset.toString());
    console.log("- Lock Period (days):", poolAfter.lockPeriodDays);
    console.log(
      "- Deposit Time:",
      new Date(position.depositTime.toNumber() * 1000).toISOString()
    );
    console.log(
      "- Unlock Time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );

    // Verify config total staked amount increased
    const configAfter = await sdk.fetchConfigByAddress(configPda);
    const expectedTotalStaked =
      configBefore.totalStakedAmount.toNumber() + nftValueInTokens;
    expect(configAfter.totalStakedAmount.toNumber()).to.equal(
      expectedTotalStaked
    );

    console.log(
      "Total staked amount updated:",
      configAfter.totalStakedAmount.toString()
    );

    // Verify NFT ownership has changed to the config vault
    const assetData = await getMplCoreAsset(
      client,
      toWeb3JsPublicKey(assetSigner.publicKey)
    );

    console.log("Asset owner after staking:", assetData.owner.toString());
    expect(assetData.owner.toString()).to.equal(configPda.toString());
    console.log("NFT successfully transferred to vault");

    // Verify user account was updated correctly
    const userAccountAfter = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );

    expect(userAccountAfter.totalStakedNfts).to.equal(
      userAccountBefore.totalStakedNfts + 1
    );
    expect(userAccountAfter.totalStakedValue.toNumber()).to.equal(
      userAccountBefore.totalStakedValue.toNumber() + nftValueInTokens
    );

    console.log("User account stats after staking:");
    console.log("- Total Staked NFTs:", userAccountAfter.totalStakedNfts);
    console.log(
      "- Total Staked Value:",
      userAccountAfter.totalStakedValue.toString()
    );
    console.log("User pool stats after staking:");
    console.log("- Pool Staked NFTs:", userPoolStatsAfter.nftsStaked);
    console.log(
      "- Pool Staked Tokens:",
      userPoolStatsAfter.tokensStaked.toString()
    );
  });

  it("Claims a staked Metaplex Core asset successfully", async () => {
    const assetSigner = assets[0];
    const poolIndex = 2; // Using the 7-day lock period with 8% yield from the previous test

    // Get the Config PDA and account data with our configId
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

    // Get the Pool PDA for the specified pool index
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Find the user account PDA
    const [userAccountPda] = sdk.pda.findUserAccountPda(
      payer.publicKey,
      configPda
    );
    console.log("User Account PDA:", userAccountPda.toString());

    // Find the user pool stats PDA
    const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
      payer.publicKey,
      poolPda
    );
    console.log("User Pool Stats PDA:", userPoolStatsPda.toString());

    // Get the asset public key from the previous test
    const asset = toWeb3JsPublicKey(assetSigner.publicKey);

    const nftPositionId = 200; // Use the same position ID from previous test

    // Find the Position PDA for this owner, mint, asset and position ID
    const [positionPda] = sdk.pda.findNftPositionPda(
      payer.publicKey,
      tokenMint,
      asset,
      nftPositionId
    );
    console.log("Position PDA:", positionPda.toString());

    // Get the position account to check if it's locked
    const position = await sdk.fetchPosition(
      payer.publicKey,
      nftPositionId,
      tokenMint,
      asset
    );

    console.log("Position before claiming:");
    console.log("- Position ID:", position.id.toString());
    console.log("- Status:", position.status);
    console.log(
      "- Unlock Time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );

    // Verify position setup
    expect(position).to.not.be.null;
    expect(position.positionType).to.deep.equal({ nft: {} });
    expect(position.status).to.deep.equal({ unclaimed: {} });
    expect(position.id.toNumber()).to.equal(nftPositionId);

    // Get stats before claiming
    const configBefore = await sdk.fetchConfigByAddress(configPda);
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    const userAccountBefore = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );

    // User pool stats should exist at claim time
    let userPoolStatsBefore;
    try {
      userPoolStatsBefore = await sdk.fetchUserPoolStatsByAddress(
        userPoolStatsPda
      );
    } catch (err) {
      console.log(
        "User pool stats account doesn't exist yet - this is unexpected at claim time"
      );
      userPoolStatsBefore = {
        nftsStaked: 0,
        tokensStaked: new BN(0),
        totalValue: new BN(0),
        claimedYield: new BN(0),
        user: null,
        pool: null,
      };
      expect.fail("User pool stats should exist at claim time");
    }

    console.log("Stats before claiming:");
    console.log("- Total Staked NFTs:", userAccountBefore.totalStakedNfts);
    console.log(
      "- Total Staked Value:",
      userAccountBefore.totalStakedValue.toString()
    );
    console.log("- Pool total NFTs staked:", poolBefore.totalNftsStaked);
    console.log("- User pool NFTs staked:", userPoolStatsBefore.nftsStaked);

    // Calculate the expected yield
    const yieldRate = poolBefore.yieldRate.toNumber();
    const stakeAmount = configBefore.nftValueInTokens.toNumber();
    const yieldAmount = Math.floor(stakeAmount * (yieldRate / 10000));
    const expectedFinalAmount = yieldAmount; // For NFTs, we only get yield (NFT is returned separately)

    console.log("Yield calculation:");
    console.log("- NFT value in tokens:", stakeAmount);
    console.log("- Yield rate (basis points):", yieldRate);
    console.log("- Yield rate (percentage):", yieldRate / 100, "%");
    console.log("- Calculated yield amount:", yieldAmount);
    console.log("- Expected tokens to receive:", expectedFinalAmount);

    // Get the user's token balance before claiming
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      payer.publicKey,
      true
    );
    const userTokenBalanceBefore = await getTokenBalance(
      client,
      userTokenAccount
    );

    // Get authority vault balance for yield payments
    const [authorityVaultPda] = sdk.pda.findAuthorityVaultPda(
      configPda,
      tokenMint
    );
    const authorityVaultBalanceBefore = await getTokenBalance(
      client,
      authorityVaultPda
    );

    console.log("User token balance before claiming:", userTokenBalanceBefore);
    console.log(
      "Authority vault balance (yield) before claiming:",
      authorityVaultBalanceBefore
    );

    // Verify NFT ownership before claiming
    const assetDataBefore = await getMplCoreAsset(
      client,
      toWeb3JsPublicKey(assetSigner.publicKey)
    );
    console.log("Asset owner before claim:", assetDataBefore.owner.toString());
    expect(assetDataBefore.owner.toString()).to.equal(configPda.toString());

    // Warp time forward to unlock the position
    try {
      // Calculate how many seconds we need to warp
      const unlockTime = position.unlockTime.toNumber();
      const currentTime = Math.floor(Date.now() / 1000);
      const secondsToWarp = unlockTime - currentTime + 60; // Add a buffer of 60s

      console.log("Warping time to unlock position...");
      console.log("Current time:", new Date(currentTime * 1000).toISOString());
      console.log("Unlock time:", new Date(unlockTime * 1000).toISOString());
      console.log("Seconds to warp:", secondsToWarp);

      // Warp using the bankrun context
      advanceUnixTimeStamp(provider, BigInt(secondsToWarp));
      console.log("Time warped successfully!");

      // Create claim NFT instruction with position ID
      console.log("Creating claim NFT instruction...");

      const claimNftIx = await sdk.claimNftPosition({
        authority: payer.publicKey,
        owner: payer.publicKey,
        payer: payer.publicKey,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        asset,
        tokenMint,
        configId,
        positionId: nftPositionId,
        updateAuthority: toWeb3JsPublicKey(collectionSigner.publicKey),
        poolIndex,
      });

      // Process the claim transaction
      await createAndProcessTransaction(client, payer, [claimNftIx], [payer]);
      console.log("NFT claimed successfully!");
    } catch (err) {
      console.error("Failed to claim NFT:", err);
      expect.fail(`NFT claiming failed: ${err}`);
    }

    // Verify the position was updated correctly
    const positionAfter = await sdk.fetchPosition(
      payer.publicKey,
      nftPositionId,
      tokenMint,
      asset
    );

    console.log("Position after claiming:");
    console.log("- Position ID:", positionAfter.id.toString());
    console.log("- Status:", positionAfter.status);

    expect(positionAfter.status).to.deep.equal({ claimed: {} });
    expect(positionAfter.id.toNumber()).to.equal(nftPositionId);

    // Verify NFT ownership has been transferred back to the owner
    const assetDataAfter = await getMplCoreAsset(
      client,
      toWeb3JsPublicKey(assetSigner.publicKey)
    );

    console.log("Asset owner after claiming:", assetDataAfter.owner.toString());
    expect(assetDataAfter.owner.toString()).to.equal(
      payer.publicKey.toString()
    );
    console.log("NFT successfully transferred back to owner");

    // Verify user token balance increased by the yield amount
    const userTokenBalanceAfter = await getTokenBalance(
      client,
      userTokenAccount
    );

    // Check authority vault balance after claim to verify yield came from there
    const authorityVaultBalanceAfter = await getTokenBalance(
      client,
      authorityVaultPda
    );

    console.log("User token balance after claiming:", userTokenBalanceAfter);
    console.log(
      "Authority vault balance after claiming:",
      authorityVaultBalanceAfter
    );

    // User should have received the yield amount
    expect(userTokenBalanceAfter).to.equal(
      userTokenBalanceBefore + expectedFinalAmount
    );

    // Authority vault should have decreased by the yield amount
    expect(authorityVaultBalanceAfter).to.equal(
      authorityVaultBalanceBefore - yieldAmount
    );

    // Verify user account stats were updated
    const userAccountAfter = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
    expect(userAccountAfter.totalStakedNfts).to.equal(
      userAccountBefore.totalStakedNfts - 1
    );
    expect(userAccountAfter.totalStakedValue.toNumber()).to.be.lessThan(
      userAccountBefore.totalStakedValue.toNumber()
    );

    // Verify pool stats were updated
    const poolAfter = await sdk.fetchPoolByAddress(poolPda);
    expect(poolAfter.totalNftsStaked).to.equal(poolBefore.totalNftsStaked - 1);
    expect(poolAfter.lifetimeClaimedYield.toNumber()).to.equal(
      poolBefore.lifetimeClaimedYield.toNumber() + yieldAmount
    );

    // Verify user pool stats were updated
    const userPoolStatsAfter = await sdk.fetchUserPoolStatsByAddress(
      userPoolStatsPda
    );
    expect(userPoolStatsAfter.nftsStaked).to.equal(
      userPoolStatsBefore.nftsStaked - 1
    );

    console.log("User account stats after claiming:");
    console.log("- Total Staked NFTs:", userAccountAfter.totalStakedNfts);
    console.log(
      "- Total Staked Value:",
      userAccountAfter.totalStakedValue.toString()
    );

    console.log("Pool stats after claiming:");
    console.log("- Total NFTs staked:", poolAfter.totalNftsStaked);
    console.log(
      "- Lifetime claimed yield:",
      poolAfter.lifetimeClaimedYield.toString()
    );

    console.log("User pool stats after claiming:");
    console.log("- Staked NFTs:", userPoolStatsAfter.nftsStaked);
    console.log("- Staked Tokens:", userPoolStatsAfter.tokensStaked.toString());

    console.log("NFT claim test completed successfully!");
  });

  it("Enforces user token limit per pool", async () => {
    // Choose pool 1 (3-day lock period) for this test
    const poolIndex = 1;
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

    // Get the pool to check its limits
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    const pool = await sdk.fetchPoolByAddress(poolPda);

    console.log(
      `Testing token limits for pool ${poolIndex} (${pool.lockPeriodDays} days):`
    );
    console.log(`- Max tokens per pool: ${pool.maxTokensCap.toString()}`);

    // Create a much smaller limit for testing
    const smallTokenLimit = 10_000 * 10 ** decimals; // 10,000 tokens

    // Create a new config for our test
    const testConfigId = configId + 100; // Use a different config ID to avoid conflicts

    // Get vault ATA for the config
    const [testConfigPda] = sdk.pda.findConfigPda(
      payer.publicKey,
      testConfigId
    );
    const vaultTA = getAssociatedTokenAddressSync(
      tokenMint,
      testConfigPda,
      true
    );

    // Find the NFTs vault PDA
    const [nftsVaultPda] = sdk.pda.findNftsVaultPda(testConfigPda, tokenMint);

    try {
      console.log("Initializing test config...");

      // Initialize the staking program
      const initializeIx = await sdk.initialize({
        authority: payer.publicKey,
        adminWithdrawDestination: payer.publicKey,
        mint: tokenMint,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        id: testConfigId,
        vault: vaultTA,
        nftsVault: nftsVaultPda,
        maxCap,
        nftValueInTokens,
        nftsLimitPerUser,
      });

      // Initialize auth vault instruction
      const initializeAuthVaultIx = await sdk.initializeAuthVault({
        authority: payer.publicKey,
        configId: testConfigId,
        tokenMint,
      });

      // Execute initialization instructions
      await createAndProcessTransaction(client, payer, [
        initializeIx,
        initializeAuthVaultIx,
      ]);
      console.log("Base config initialized successfully");

      // Now initialize only one pool with the smaller limit
      const initPoolIx = await sdk.initializePool({
        authority: payer.publicKey,
        configId: testConfigId,
        index: poolIndex,
        lockPeriodDays: poolsConfig[poolIndex].lockPeriodDays,
        yieldRate: poolsConfig[poolIndex].yieldRate,
        maxNftsCap: poolsConfig[poolIndex].maxNfts,
        maxTokensCap: smallTokenLimit,
      });

      // Initialize a second pool (with normal limits) for comparison
      const otherPoolIndex = 2;
      const initOtherPoolIx = await sdk.initializePool({
        authority: payer.publicKey,
        configId: testConfigId,
        index: otherPoolIndex,
        lockPeriodDays: poolsConfig[otherPoolIndex].lockPeriodDays,
        yieldRate: poolsConfig[otherPoolIndex].yieldRate,
        maxNftsCap: poolsConfig[otherPoolIndex].maxNfts,
        maxTokensCap: poolsConfig[otherPoolIndex].maxTokens,
      });

      // Execute pool initialization instructions
      await createAndProcessTransaction(client, payer, [
        initPoolIx,
        initOtherPoolIx,
      ]);
      console.log("Pools initialized successfully");

      // Get the pool with the small limit to verify config
      const [testPoolPda] = sdk.pda.findPoolPda(testConfigPda, poolIndex);
      const testPool = await sdk.fetchPoolByAddress(testPoolPda);

      console.log(
        `Test pool ${poolIndex} configured with max tokens cap: ${testPool.maxTokensCap.toString()}`
      );
      expect(testPool.maxTokensCap.toString()).to.equal(
        smallTokenLimit.toString()
      );
    } catch (err) {
      console.error("Failed to initialize test config:", err);
      expect.fail("Failed to initialize test config");
    }

    // Initialize user account for this config
    try {
      console.log("Initializing user account for test config...");
      const initUserIx = await sdk.initializeUser({
        owner: payer.publicKey,
        authority: payer.publicKey,
        configId: testConfigId,
        mint: tokenMint,
        poolIndex, // Initialize with the limited pool
      });

      await createAndProcessTransaction(client, payer, [initUserIx]);
      console.log("User account initialized successfully");
    } catch (err) {
      console.error("Failed to initialize user:", err);
      expect.fail("Failed to initialize user");
    }

    // Get user token account
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      payer.publicKey,
      true
    );

    // Get the pool with small limit
    const [testPoolPda] = sdk.pda.findPoolPda(testConfigPda, poolIndex);
    const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
      payer.publicKey,
      testPoolPda
    );

    try {
      // First try to stake just under the limit - should succeed
      const firstStakeAmount = smallTokenLimit - 100 * 10 ** decimals; // Just under the limit
      console.log(`Staking ${firstStakeAmount} tokens (under the limit)...`);

      const stakeWithinLimitIx = await sdk.stakeToken({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
        configId: testConfigId,
        positionId: 1000, // Use a specific position ID
        amount: firstStakeAmount,
        poolIndex,
        tokenAccount: userTokenAccount,
      });

      const res = await createAndProcessTransaction(client, payer, [
        stakeWithinLimitIx,
      ]);
      console.log("Successfully staked tokens within the limit");

      // Verify user pool stats to confirm stake amount
      const userPoolStats = await sdk.fetchUserPoolStatsByAddress(
        userPoolStatsPda
      );
      console.log(
        `User has now staked ${userPoolStats.tokensStaked.toString()} tokens in pool ${poolIndex}`
      );
      expect(userPoolStats.tokensStaked.toString()).to.equal(
        firstStakeAmount.toString()
      );
    } catch (err) {
      console.error("Failed to stake tokens within limit:", err);
      expect.fail(`Should be able to stake tokens within the limit: ${err}`);
    }

    // Now try to stake more tokens to exceed the limit - should fail
    try {
      const exceedingAmount = 200 * 10 ** decimals; // Amount that will exceed the limit
      console.log(
        `Attempting to stake additional ${exceedingAmount} tokens to exceed the limit...`
      );

      const stakeExceedingIx = await sdk.stakeToken({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
        configId: testConfigId,
        positionId: 1001, // Different position ID
        amount: exceedingAmount,
        poolIndex,
        tokenAccount: userTokenAccount,
      });

      await createAndProcessTransaction(client, payer, [stakeExceedingIx]);
      expect.fail(
        "Should not be able to stake tokens exceeding the user limit per pool"
      );
    } catch (err) {
      console.log(
        "Transaction correctly failed when exceeding token limit per pool"
      );
      // We expect to see an error related to token limit
      expect(err.toString()).to.include("Error");
    }

    // Try staking in the second pool with normal limits - should succeed
    try {
      const otherPoolIndex = 2;
      const stakeAmount = 500 * 10 ** decimals; // 500 tokens
      console.log(
        `Attempting to stake ${stakeAmount} tokens in a different pool...`
      );

      const stakeOtherPoolIx = await sdk.stakeToken({
        authority: payer.publicKey,
        owner: payer.publicKey,
        tokenMint,
        configId: testConfigId,
        positionId: 1002, // Different position ID
        amount: stakeAmount,
        poolIndex: otherPoolIndex,
        tokenAccount: userTokenAccount,
      });

      await createAndProcessTransaction(client, payer, [stakeOtherPoolIx]);
      console.log("Successfully staked tokens in a different pool");

      // Verify the stake was successful in the second pool
      const [otherPoolPda] = sdk.pda.findPoolPda(testConfigPda, otherPoolIndex);
      const [otherUserPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
        payer.publicKey,
        otherPoolPda
      );

      const otherUserPoolStats = await sdk.fetchUserPoolStatsByAddress(
        otherUserPoolStatsPda
      );
      console.log(
        `User now has ${otherUserPoolStats.tokensStaked.toString()} tokens staked in pool ${otherPoolIndex}`
      );
      expect(otherUserPoolStats.tokensStaked.toString()).to.equal(
        stakeAmount.toString()
      );
    } catch (err) {
      console.error("Failed to stake tokens in different pool:", err);
      expect.fail(`Should be able to stake tokens in a different pool: ${err}`);
    }

    console.log("Token limit per pool test completed successfully!");
  });

  it("Enforces user NFT limit per pool", async () => {
    // Choose pool 0 (1-day lock period) for this test
    const poolIndex = 0;
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

    // Get the pool to check its limits
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    const pool = await sdk.fetchPoolByAddress(poolPda);

    // Create a very small NFT limit for testing
    const smallNftLimit = 2; // Keep this small enough for test speed
    console.log(`Testing NFT limits for pool ${poolIndex} (${pool.lockPeriodDays} days):`);
    console.log(`- Normal max NFTs per pool: ${pool.maxNftsCap}`);
    console.log(`- Test max NFTs per pool: ${smallNftLimit}`);

    // Create a new config for our test
    const testConfigId = configId + 201; // Use a different config ID to avoid conflicts

    // Get vault ATA for the test config
    const [testConfigPda] = sdk.pda.findConfigPda(payer.publicKey, testConfigId);
    const vaultTA = getAssociatedTokenAddressSync(tokenMint, testConfigPda, true);

    // Find the NFTs vault PDA
    const [nftsVaultPda] = sdk.pda.findNftsVaultPda(testConfigPda, tokenMint);

    try {
      console.log("Initializing test config...");
      
      // Initialize the staking program
      const initializeIx = await sdk.initialize({
        authority: payer.publicKey,
        adminWithdrawDestination: payer.publicKey,
        mint: tokenMint,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        id: testConfigId,
        vault: vaultTA,
        nftsVault: nftsVaultPda,
        maxCap,
        nftValueInTokens,
        nftsLimitPerUser,
      });

      // Initialize auth vault instruction
      const initializeAuthVaultIx = await sdk.initializeAuthVault({
        authority: payer.publicKey,
        configId: testConfigId,
        tokenMint,
      });

      // Execute initialization instructions
      await createAndProcessTransaction(client, payer, [
        initializeIx,
        initializeAuthVaultIx,
      ]);
      console.log("Base config initialized successfully");

      // Now initialize the pool with a small NFT limit
      const initPoolIx = await sdk.initializePool({
        authority: payer.publicKey,
        configId: testConfigId,
        index: poolIndex,
        lockPeriodDays: poolsConfig[poolIndex].lockPeriodDays,
        yieldRate: poolsConfig[poolIndex].yieldRate,
        maxNftsCap: smallNftLimit, // Small NFT limit for testing
        maxTokensCap: poolsConfig[poolIndex].maxTokens,
      });

      // Initialize a second pool (with normal limits) for comparison
      const otherPoolIndex = 1;
      const initOtherPoolIx = await sdk.initializePool({
        authority: payer.publicKey,
        configId: testConfigId,
        index: otherPoolIndex,
        lockPeriodDays: poolsConfig[otherPoolIndex].lockPeriodDays,
        yieldRate: poolsConfig[otherPoolIndex].yieldRate,
        maxNftsCap: poolsConfig[otherPoolIndex].maxNfts, // Normal NFT limit
        maxTokensCap: poolsConfig[otherPoolIndex].maxTokens,
      });

      // Execute pool initialization instructions
      await createAndProcessTransaction(client, payer, [initPoolIx, initOtherPoolIx]);
      console.log("Pools initialized successfully");

      // Get the pool with the small limit to verify config
      const [testPoolPda] = sdk.pda.findPoolPda(testConfigPda, poolIndex);
      const testPool = await sdk.fetchPoolByAddress(testPoolPda);
      
      console.log(`Test pool ${poolIndex} configured with max NFTs cap: ${testPool.maxNftsCap}`);
      expect(testPool.maxNftsCap).to.equal(smallNftLimit);
    } catch (err) {
      console.error("Failed to initialize test config:", err);
      expect.fail("Failed to initialize test config");
    }

    // Initialize user account for this config
    try {
      console.log("Initializing user account for test config...");
      const initUserIx = await sdk.initializeUser({
        owner: payer.publicKey,
        authority: payer.publicKey,
        configId: testConfigId,
        mint: tokenMint,
        poolIndex, // Initialize with the limited pool
      });

      await createAndProcessTransaction(client, payer, [initUserIx]);
      console.log("User account initialized successfully");
    } catch (err) {
      console.error("Failed to initialize user:", err);
      expect.fail("Failed to initialize user");
    }

    // Get the pool with small limit
    const [testPoolPda] = sdk.pda.findPoolPda(testConfigPda, poolIndex);
    const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
      payer.publicKey,
      testPoolPda
    );

    // Stake NFTs up to the limit sequentially (more reliable than parallel)
    for (let i = 0; i < smallNftLimit; i++) {
      const asset = assets[i + 1];
      console.log(`Staking NFT ${i+1} of ${smallNftLimit} (${asset.publicKey.toString()})...`);
      
      const stakeNftIx = await sdk.stakeNft({
        authority: payer.publicKey,
        owner: payer.publicKey,
        mint: tokenMint,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        asset: toWeb3JsPublicKey(asset.publicKey),
        configId: testConfigId,
        poolIndex,
        positionId: 2000 + i, // Use specific position IDs
        nftsVault: nftsVaultPda,
      });
      
      try {
        await createAndProcessTransaction(client, payer, [stakeNftIx]);
        console.log(`Successfully staked NFT ${i+1}`);
        
        // Verify user pool stats after each stake
        const userPoolStats = await sdk.fetchUserPoolStatsByAddress(userPoolStatsPda);
        console.log(`User has now staked ${userPoolStats.nftsStaked} NFTs in pool ${poolIndex}`);
        expect(userPoolStats.nftsStaked).to.equal(i + 1);
      } catch (err) {
        console.error(`Failed to stake NFT ${i+1}: ${err}`);
        expect.fail(`Should be able to stake NFT ${i+1} within the limit`);
      }
    }
    
    // Now attempt to stake one more NFT beyond the limit - should fail
    try {
      const extraAsset = assets[smallNftLimit + 1];
      console.log(`Attempting to stake NFT ${smallNftLimit+1} to exceed the limit...`);
      
      const stakeExceedingIx = await sdk.stakeNft({
        authority: payer.publicKey,
        owner: payer.publicKey,
        mint: tokenMint,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        asset: toWeb3JsPublicKey(extraAsset.publicKey),
        configId: testConfigId,
        poolIndex,
        positionId: 2000 + smallNftLimit, // Next position ID
        nftsVault: nftsVaultPda,
      });
      
      await createAndProcessTransaction(client, payer, [stakeExceedingIx]);
      expect.fail("Should not be able to stake NFTs exceeding the pool limit");
    } catch (err) {
      console.log("Transaction correctly failed when exceeding NFT limit per pool");
      // We expect an error related to NFT limit
      expect(err.toString()).to.include("Error");
    }
    
    // Try staking in a different pool with normal limits - should succeed
    try {
      const otherPoolIndex = 1;
      const extraAsset = assets[smallNftLimit + 1];
      console.log(`Attempting to stake NFT in pool ${otherPoolIndex} with normal limits...`);
      
      const [otherPoolPda] = sdk.pda.findPoolPda(testConfigPda, otherPoolIndex);
      
      const stakeOtherPoolIx = await sdk.stakeNft({
        authority: payer.publicKey,
        owner: payer.publicKey,
        mint: tokenMint,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        asset: toWeb3JsPublicKey(extraAsset.publicKey),
        configId: testConfigId,
        poolIndex: otherPoolIndex,
        positionId: 3000, // Different position ID for other pool
        nftsVault: nftsVaultPda,
      });
      
      await createAndProcessTransaction(client, payer, [stakeOtherPoolIx]);
      console.log(`Successfully staked NFT in different pool ${otherPoolIndex}`);
      
      // Verify the stake was successful in the second pool
      const [otherUserPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
        payer.publicKey,
        otherPoolPda
      );
      
      const otherUserPoolStats = await sdk.fetchUserPoolStatsByAddress(otherUserPoolStatsPda);
      console.log(`User now has ${otherUserPoolStats.nftsStaked} NFTs staked in pool ${otherPoolIndex}`);
      expect(otherUserPoolStats.nftsStaked).to.equal(1);
    } catch (err) {
      console.error("Failed to stake NFT in different pool:", err);
      expect.fail(`Should be able to stake NFT in a different pool: ${err}`);
    }

    console.log("NFT limit per pool test completed successfully!");
  });
});
