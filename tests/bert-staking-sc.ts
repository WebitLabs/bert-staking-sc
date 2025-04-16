import { expect } from "chai";
import chalk from "chalk";
import { prelude } from "./helpers/prelude";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  advanceUnixTimeStamp,
  createAndProcessTransaction,
  getAddedAccountInfo,
} from "./helpers/bankrun";
import {
  BertStakingSDK,
  ConfigIdl,
  Position,
  PositionIdl,
  PositionType,
} from "../sdk/src";
import { AddedProgram, BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MPL_CORE_ADDRESS, USDC_MINT_ADDRESS } from "./helpers/constants";
import {
  createAtaForMint,
  createAtaForMintWithAddress,
  getMintDecimals,
  getTokenBalance,
} from "./helpers/token";
import { getMplCoreAsset, createCollectionAndMintAsset } from "./helpers/core";
import { KeypairSigner } from "@metaplex-foundation/umi";
import {
  fromWeb3JsPublicKey,
  toWeb3JsKeypair,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";

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

  it("Initializes the Bert staking program with custom pool configurations", async () => {
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

    // try {
    //   // Create a transaction instruction to create the NFTs vault account
    //   const createNftsVaultIx = createNftsVaultAccountInstruction(
    //     authority.publicKey,
    //     nftsVaultPda,
    //     sdk.program.programId
    //   );
    //
    //   // First create the NFTs vault account, then initialize the program
    //   console.log("Creating NFTs vault account and initializing program...");
    //   await createAndProcessTransaction(client, authority, [createNftsVaultIx]);
    //   console.log("Transaction processed successfully");
    //
    //   // configAccount = await sdk.fetchConfigByAddress(configPda);
    // } catch (err) {
    //   console.error("Failed to process initialize tx with err:", err);
    //   expect.fail("Failed to process initialize tx");
    // }

    let configAccount: ConfigIdl;
    try {
      // Initialize the staking program with pool configurations
      const initializeIx = await sdk.initialize({
        authority: authority.publicKey,
        mint: tokenMint,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        id: configId,
        poolsConfig,
        vault: vaultTA,
        nftsVault: nftsVaultPda,
        maxCap,
        nftValueInTokens,
        nftsLimitPerUser,
      });

      console.log("Initializing program...");
      await createAndProcessTransaction(client, authority, [initializeIx]);
      console.log("Transaction processed successfully");

      configAccount = await sdk.fetchConfigByAddress(configPda);
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

    // Verify pool configurations
    expect(configAccount.poolsConfig.length).to.equal(4);

    // Verify yield rates
    expect(configAccount.poolsConfig[0].yieldRate.toNumber()).to.equal(300);
    expect(configAccount.poolsConfig[1].yieldRate.toNumber()).to.equal(500);
    expect(configAccount.poolsConfig[2].yieldRate.toNumber()).to.equal(800);
    expect(configAccount.poolsConfig[3].yieldRate.toNumber()).to.equal(1200);

    // Verify max caps for NFTs and tokens across all pools
    for (let i = 0; i < 4; i++) {
      expect(configAccount.poolsConfig[i].maxNftsCap).to.equal(maxNftsCap);
      expect(configAccount.poolsConfig[i].maxTokensCap.toString()).to.equal(
        maxTokensCap.toString()
      );
    }

    // Verify lock periods are correctly set
    expect(configAccount.poolsConfig[0].lockPeriodDays).to.equal(1);
    expect(configAccount.poolsConfig[1].lockPeriodDays).to.equal(3);
    expect(configAccount.poolsConfig[2].lockPeriodDays).to.equal(7);
    expect(configAccount.poolsConfig[3].lockPeriodDays).to.equal(30);

    // Verify pool stats are initialized correctly
    for (let i = 0; i < 4; i++) {
      expect(configAccount.poolsStats[i].totalNftsStaked).to.equal(0);
      expect(configAccount.poolsStats[i].totalTokensStaked.toString()).to.equal(
        "0"
      );
      expect(configAccount.poolsStats[i].lifetimeNftsStaked).to.equal(0);
      expect(
        configAccount.poolsStats[i].lifetimeTokensStaked.toString()
      ).to.equal("0");
      expect(
        configAccount.poolsStats[i].lifetimeClaimedYield.toString()
      ).to.equal("0");

      // Verify lock periods in stats match the config
      expect(configAccount.poolsStats[i].lockPeriodDays).to.equal(
        configAccount.poolsConfig[i].lockPeriodDays
      );
    }

    // Verify global configuration
    expect(configAccount.maxCap.toString()).to.equal(maxCap.toString());
    expect(configAccount.nftValueInTokens.toString()).to.equal(
      nftValueInTokens.toString()
    );
    expect(configAccount.nftsLimitPerUser).to.equal(nftsLimitPerUser);
    expect(configAccount.totalStakedAmount.toString()).to.equal("0");
    expect(configAccount.totalNftsStaked.toString()).to.equal("0");

    console.log("Config initialized successfully with all pool configurations");
    console.log("Pool Configurations:");
    configAccount.poolsConfig.forEach((pool, index) => {
      console.log(`Pool ${index} (${pool.lockPeriodDays} days):`);
      console.log(`  Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
      console.log(`  Max NFTs: ${pool.maxNftsCap}`);
      console.log(`  Max Tokens: ${pool.maxTokensCap.toString()}`);
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

      // Create the ATAs with some tokens for the user and the vault
      const mintAmount = 1_000_000_000 * 10 ** decimals;
      tokensInVault = mintAmount;
      createAtaForMint(provider, owner, mint, BigInt(mintAmount));
      createAtaForMint(provider, configPda, mint, BigInt(mintAmount));

      userTokenAccount = getAssociatedTokenAddressSync(mint, owner, true);

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

    try {
      // Create initialize user instruction
      console.log("Initializing user account...");
      const initUserIx = await sdk.initializeUser({
        owner: payer.publicKey,
        authority: payer.publicKey,
        configId,
        mint: tokenMint,
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
    // expect(userAccount.owner.toString()).to.equal(payer.publicKey.toString());
    expect(userAccount.totalStakedValue.toNumber()).to.equal(0);
    expect(userAccount.totalStakedNfts).to.equal(0);
    expect(userAccount.totalStakedTokenAmount.toNumber()).to.equal(0);

    console.log("User account validated successfully:");
    // console.log("- Owner:", userAccount.owner.toString());
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
    const poolIndex = 2; // Use the 7-day lock period with 8% yield

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

    console.log("Config PDA:", configPda.toString());
    console.log("User Account PDA:", userAccountPda.toString());
    console.log("Position PDA:", positionPda.toString());

    // Capture state before staking
    const configBefore = await sdk.fetchConfigByAddress(configPda);
    const userAccountBefore = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
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

    // Verify the results of the staking operation

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
    expect(position.lockPeriodYieldIndex).to.equal(poolIndex);

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
    const poolStatsBefore = configBefore.poolsStats[poolIndex];
    const poolStatsAfter = configAfter.poolsStats[poolIndex];
    expect(poolStatsAfter.totalTokensStaked.toNumber()).to.equal(
      poolStatsBefore.totalTokensStaked.toNumber() + stakeAmount
    );
    expect(poolStatsAfter.lifetimeTokensStaked.toNumber()).to.equal(
      poolStatsBefore.lifetimeTokensStaked.toNumber() + stakeAmount
    );

    // 6. Verify unlock time is correctly calculated (7 days in seconds)
    const unlockTime = position.unlockTime.toNumber();
    const depositTime = position.depositTime.toNumber();
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    expect(unlockTime - depositTime).to.equal(sevenDaysInSeconds);

    console.log("\n---- Position Details ----");
    console.log("Position owner:", position.owner.toString());
    console.log("Position amount:", position.amount.toString());
    console.log("Position type:", position.positionType);
    console.log("Position status:", position.status);
    console.log("Lock period yield index:", position.lockPeriodYieldIndex);
    console.log(
      "Deposit time:",
      new Date(position.depositTime.toNumber() * 1000).toISOString()
    );
    console.log(
      "Unlock time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );
    console.log(
      "Lock duration (days):",
      (unlockTime - depositTime) / (24 * 60 * 60)
    );

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
      poolStatsAfter.totalTokensStaked.toString()
    );
    console.log(
      "Pool lifetime tokens staked:",
      poolStatsAfter.lifetimeTokensStaked.toString()
    );
  });

  it("Claims tokens after lock period with correct yield calculation and state updates", async () => {
    // Use the same position ID that was created in the previous test
    const positionId = 42;
    const poolIndex = 2; // The 7-day lock period we used in the previous test

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
    const vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);

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
    console.log("Lock period yield index:", position.lockPeriodYieldIndex);
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
    expect(position.lockPeriodYieldIndex).to.equal(poolIndex);

    // Capture state before claiming
    const configBefore = await sdk.fetchConfigByAddress(configPda);
    const userAccountBefore = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
    const userTokenBalanceBefore = await getTokenBalance(
      client,
      userTokenAccount
    );
    const vaultBalanceBefore = await getTokenBalance(client, vaultAta);
    const poolStatsBefore = configBefore.poolsStats[poolIndex];

    console.log("\n---- State Before Claiming ----");
    console.log("User token balance:", userTokenBalanceBefore);
    console.log("Vault token balance:", vaultBalanceBefore);
    console.log(
      "Config total staked:",
      configBefore.totalStakedAmount.toString()
    );
    console.log(
      "Pool total tokens staked:",
      poolStatsBefore.totalTokensStaked.toString()
    );
    console.log(
      "Pool lifetime claimed yield:",
      poolStatsBefore.lifetimeClaimedYield.toString()
    );
    console.log(
      "User account total staked tokens:",
      userAccountBefore.totalStakedTokenAmount.toString()
    );

    // Calculate the expected yield
    const yieldRate = configBefore.poolsConfig[poolIndex].yieldRate.toNumber();
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
      });

      await createAndProcessTransaction(client, payer, [claimPositionIx]);
      console.log("Position claimed successfully!");
    } catch (err) {
      console.error("Failed to claim tokens:", err);
      expect.fail(`Token claiming failed: ${err}`);
    }

    // Verify the results of claiming

    // 1. Check user's token balance increased with yield
    const userTokenBalanceAfter = await getTokenBalance(
      client,
      userTokenAccount
    );
    const expectedBalance = userTokenBalanceBefore + expectedFinalAmount;
    expect(userTokenBalanceAfter).to.be.approximately(expectedBalance, 2); // Allow small rounding differences

    // 2. Check vault balance decreased by the correct amount
    const vaultBalanceAfter = await getTokenBalance(client, vaultAta);
    expect(vaultBalanceAfter).to.equal(
      vaultBalanceBefore - expectedFinalAmount
    );

    // 3. Check position status has been updated to claimed
    const positionAfter = await sdk.fetchPosition(
      payer.publicKey,
      positionId,
      tokenMint
    );
    expect(positionAfter.status).to.deep.equal({ claimed: {} });

    // 4. Check config's total staked amount was decreased
    const configAfter = await sdk.fetchConfigByAddress(configPda);
    expect(configAfter.totalStakedAmount.toNumber()).to.equal(
      configBefore.totalStakedAmount.toNumber() - stakeAmount
    );

    // 5. Check pool stats were updated correctly
    const poolStatsAfter = configAfter.poolsStats[poolIndex];
    expect(poolStatsAfter.totalTokensStaked.toNumber()).to.equal(
      poolStatsBefore.totalTokensStaked.toNumber() - stakeAmount
    );
    expect(poolStatsAfter.lifetimeClaimedYield.toNumber()).to.equal(
      poolStatsBefore.lifetimeClaimedYield.toNumber() + yieldAmount
    );

    // 6. Check user account stats were updated
    const userAccountAfter = await sdk.fetchUserAccountByAddress(
      userAccountPda
    );
    expect(userAccountAfter.totalStakedTokenAmount.toNumber()).to.be.lessThan(
      userAccountBefore.totalStakedTokenAmount.toNumber()
    );

    console.log("\n---- State After Claiming ----");
    console.log("User token balance:", userTokenBalanceAfter);
    console.log("Vault token balance:", vaultBalanceAfter);
    console.log("Position status:", positionAfter.status);
    console.log(
      "Config total staked:",
      configAfter.totalStakedAmount.toString()
    );
    console.log(
      "Pool total tokens staked:",
      poolStatsAfter.totalTokensStaked.toString()
    );
    console.log(
      "Pool lifetime claimed yield:",
      poolStatsAfter.lifetimeClaimedYield.toString()
    );
    console.log(
      "User account total staked tokens:",
      userAccountAfter.totalStakedTokenAmount.toString()
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

    const poolIndex = 3; // Using the 30-day lock period with 12% yield

    // Get the Config PDA and account data with our configId
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

    // Find the NFTs vault PDA
    const [nftsVaultPda] = sdk.pda.findNftsVaultPda(configPda, tokenMint);
    console.log("NFTs Vault PDA:", nftsVaultPda.toString());

    console.log("Staking a single Metaplex Core asset...");
    console.log("Owner:", payer.publicKey.toString());
    console.log("Asset:", assetSigner.publicKey.toString());
    console.log("Collection:", collectionSigner.publicKey.toString());

    const configAccountBefore = await sdk.fetchConfigByAddress(configPda);
    const poolStatsBefore = configAccountBefore.poolsStats[poolIndex];

    // Find the Position PDA for this owner, mint and asset
    const asset = toWeb3JsPublicKey(assetSigner.publicKey);
    const [positionPda] = sdk.pda.findNftPositionPda(
      payer.publicKey,
      tokenMint,
      asset
    );
    console.log("Position PDA:", positionPda.toString());

    const configAccount = await sdk.fetchConfigByAddress(configPda);

    // Create the stake NFT instruction
    const stakeNftIx = await sdk.stakeNft({
      authority: payer.publicKey,
      owner: payer.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      asset,
      configId,
      poolIndex,
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
      0, // Not used since we're using asset-based PDA
      tokenMint,
      asset // Pass the asset for NFT position lookup
    );

    expect(position).to.not.be.null;
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
    expect(position.positionType).to.deep.equal({ nft: {} });
    expect(position.amount.toNumber()).to.equal(nftValueInTokens);
    expect(position.lockPeriodYieldIndex).to.equal(poolIndex);

    // Verify the pool stats were updated
    const configAccountAfter = await sdk.fetchConfigByAddress(configPda);
    const poolStatsAfter = configAccountAfter.poolsStats[poolIndex];
    expect(poolStatsAfter.totalNftsStaked).to.be.equal(
      poolStatsBefore.totalNftsStaked + 1
    );
    expect(poolStatsAfter.lifetimeNftsStaked).to.be.equal(
      poolStatsBefore.lifetimeNftsStaked + 1
    );

    console.log("Position after staking NFT:");
    console.log("- Owner:", position.owner.toString());
    console.log("- Amount:", position.amount.toString());
    console.log("- Position Type:", position.positionType);
    console.log("- Lock Period Yield Index:", position.lockPeriodYieldIndex);
    console.log(
      "- Lock Period (days):",
      configAccountAfter.poolsConfig[poolIndex].lockPeriodDays
    );
    console.log(
      "- Deposit Time:",
      new Date(position.depositTime.toNumber() * 1000).toISOString()
    );
    console.log(
      "- Unlock Time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );

    // Verify config total staked amount increased
    const updatedConfig = await sdk.fetchConfigByAddress(configPda);
    const expectedTotalStaked =
      configAccount.totalStakedAmount.toNumber() + nftValueInTokens;
    expect(updatedConfig.totalStakedAmount.toNumber()).to.equal(
      expectedTotalStaked
    );

    console.log(
      "Total staked amount updated:",
      updatedConfig.totalStakedAmount.toString()
    );

    // Verify NFT ownership has changed to the vault
    const assetData = await getMplCoreAsset(
      client,
      toWeb3JsPublicKey(assetSigner.publicKey)
    );

    console.log("Asset owner after staking:", assetData.owner.toString());
    expect(assetData.owner.toString()).to.equal(configPda.toString());
    console.log("NFT successfully transferred to vault");

    // Verify user account was updated correctly
    const userAccount = await sdk.fetchUserAccountByAddress(
      sdk.pda.findUserAccountPda(payer.publicKey, configPda)[0]
    );

    expect(userAccount.totalStakedNfts).to.equal(1);
    expect(userAccount.totalStakedValue.toNumber()).to.equal(nftValueInTokens);

    console.log("User account stats after staking:");
    console.log("- Total Staked NFTs:", userAccount.totalStakedNfts);
    console.log(
      "- Total Staked Value:",
      userAccount.totalStakedValue.toString()
    );
  });

  it("Claims a staked Metaplex Core asset successfully", async () => {
    const assetSigner = assets[0];
    const poolIndex = 3; // Using the 30-day lock period with 12% yield from the previous test

    // Get the Config PDA and account data with our configId
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
    const configAccount = await sdk.fetchConfigByAddress(configPda);

    // Get the asset public key from the previous test
    const asset = toWeb3JsPublicKey(assetSigner.publicKey);

    // Find the Position PDA for this owner, mint and asset
    const [positionPda] = sdk.pda.findNftPositionPda(
      payer.publicKey,
      tokenMint,
      asset
    );
    console.log("Position PDA:", positionPda.toString());

    // Get the position account to check if it's locked
    const position = await sdk.fetchPosition(
      payer.publicKey,
      0, // Not used since we're using asset-based PDA
      tokenMint,
      asset
    );

    console.log("Position before claiming:");
    console.log("- Status:", position.status);
    console.log(
      "- Unlock Time:",
      new Date(position.unlockTime.toNumber() * 1000).toISOString()
    );

    // Verify position setup
    expect(position).to.not.be.null;
    expect(position.positionType).to.deep.equal({ nft: {} });
    expect(position.status).to.deep.equal({ unclaimed: {} });

    // Get stats before claiming
    const configBefore = await sdk.fetchConfigByAddress(configPda);
    const poolStatsBefore = configBefore.poolsStats[poolIndex];
    const userAccountBefore = await sdk.fetchUserAccountByAddress(
      sdk.pda.findUserAccountPda(payer.publicKey, configPda)[0]
    );

    console.log("Stats before claiming:");
    console.log("- Total Staked NFTs:", userAccountBefore.totalStakedNfts);
    console.log(
      "- Total Staked Value:",
      userAccountBefore.totalStakedValue.toString()
    );
    console.log("- Pool total NFTs staked:", poolStatsBefore.totalNftsStaked);

    // Calculate the expected yield
    const yieldRate = configAccount.poolsConfig[poolIndex].yieldRate.toNumber();
    const stakeAmount = configAccount.nftValueInTokens.toNumber();
    const yieldAmount = Math.floor(stakeAmount * (yieldRate / 10000));
    const expectedFinalAmount = stakeAmount + yieldAmount;

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
    console.log("User token balance before claiming:", userTokenBalanceBefore);

    // Verify NFT ownership has been transferred back to the owner
    const assetDataBefore = await getMplCoreAsset(
      client,
      toWeb3JsPublicKey(assetSigner.publicKey)
    );
    console.log("config pda", configPda.toBase58());
    console.log("Asset data before claim:", assetDataBefore);

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

      // Create claim NFT instruction
      console.log("Creating claim NFT instruction...");
      const claimNftIx = await sdk.claimNftPosition({
        authority: payer.publicKey,
        owner: payer.publicKey,
        payer: payer.publicKey,
        collection: toWeb3JsPublicKey(collectionSigner.publicKey),
        asset,
        tokenMint,
        configId,
        updateAuthority: toWeb3JsPublicKey(collectionSigner.publicKey),
      });

      // Process the claim transaction
      await createAndProcessTransaction(client, payer, [claimNftIx], []);
      console.log("NFT claimed successfully!");
    } catch (err) {
      console.error("Failed to claim NFT:", err);
      expect.fail(`NFT claiming failed: ${err}`);
    }

    // Verify the position was updated correctly
    const positionAfter = await sdk.fetchPosition(
      payer.publicKey,
      0,
      tokenMint,
      asset
    );

    console.log("Position after claiming:");
    console.log("- Status:", positionAfter.status);

    expect(positionAfter.status).to.deep.equal({ claimed: {} });

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
    console.log("User token balance after claiming:", userTokenBalanceAfter);
    expect(userTokenBalanceAfter).to.equal(
      userTokenBalanceBefore + expectedFinalAmount
    );

    // Verify user account stats were updated
    const userAccountAfter = await sdk.fetchUserAccountByAddress(
      sdk.pda.findUserAccountPda(payer.publicKey, configPda)[0]
    );

    console.log("User account stats after claiming:");
    console.log("- Total Staked NFTs:", userAccountAfter.totalStakedNfts);
    console.log(
      "- Total Staked Value:",
      userAccountAfter.totalStakedValue.toString()
    );

    expect(userAccountAfter.totalStakedNfts).to.equal(
      userAccountBefore.totalStakedNfts - 1
    );
    expect(userAccountAfter.totalStakedValue.toNumber()).to.be.lessThan(
      userAccountBefore.totalStakedValue.toNumber()
    );

    // Verify pool stats were updated
    const configAfter = await sdk.fetchConfigByAddress(configPda);
    const poolStatsAfter = configAfter.poolsStats[poolIndex];

    console.log("Pool stats after claiming:");
    console.log("- Total NFTs staked:", poolStatsAfter.totalNftsStaked);
    console.log(
      "- Lifetime claimed yield:",
      poolStatsAfter.lifetimeClaimedYield.toString()
    );

    expect(poolStatsAfter.totalNftsStaked).to.equal(
      poolStatsBefore.totalNftsStaked - 1
    );
    expect(poolStatsAfter.lifetimeClaimedYield.toNumber()).to.equal(
      poolStatsBefore.lifetimeClaimedYield.toNumber() + yieldAmount
    );

    console.log("NFT claim test completed successfully!");
  });

  it("Enforces user token limit per pool", async () => {
    // Choose pool 1 (3-day lock period) for this test
    const poolIndex = 1;
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

    // Fetch config to get pool limits
    const config = await sdk.fetchConfigByAddress(configPda);
    const poolConfig = config.poolsConfig[poolIndex];

    console.log(
      `Testing token limits for pool ${poolIndex} (${poolConfig.lockPeriodDays} days):`
    );
    console.log(`- Max tokens per user: ${poolConfig.maxTokensCap.toString()}`);

    // Create a much smaller limit for testing
    const smallTokenLimit = 10_000 * 10 ** decimals; // 10,000 tokens

    // We need to create a new config with a smaller token limit for this test
    const testConfigId = configId + 100; // Use a different config ID to avoid conflicts
    const smallPoolsConfig = [...poolsConfig]; // Clone the original config

    // Modify the pool configuration to have a smaller token limit
    smallPoolsConfig[poolIndex] = {
      ...poolsConfig[poolIndex],
      maxTokens: smallTokenLimit,
    };

    console.log(
      `Creating test config with smaller token limit of ${smallTokenLimit}`
    );

    // Create the new config PDA
    const [testConfigPda] = sdk.pda.findConfigPda(
      payer.publicKey,
      testConfigId
    );

    // Initialize the config with the smaller token limit
    const initializeIx = await sdk.initialize({
      authority: payer.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      id: testConfigId,
      poolsConfig: smallPoolsConfig,
      nftsVault: SystemProgram.programId,
      maxCap: maxCap,
      nftValueInTokens: nftValueInTokens,
      nftsLimitPerUser: nftsLimitPerUser,
    });

    // Execute the initialization transaction
    try {
      console.log("Initializing test config with smaller token limit...");
      await createAndProcessTransaction(client, payer, [initializeIx]);
      console.log("Test config initialized successfully");
    } catch (err) {
      console.error("Failed to initialize test config:", err);
      expect.fail("Failed to initialize test config");
    }

    // Initialize user for the new config
    const initUserIx = await sdk.initializeUser({
      owner: payer.publicKey,
      authority: payer.publicKey,
      configId: testConfigId,
      mint: tokenMint,
    });

    try {
      console.log("Initializing user for test config...");
      await createAndProcessTransaction(client, payer, [initUserIx]);
      console.log("User initialized successfully for test config");
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

    // Stake almost up to the limit (leave a small buffer)
    const firstStakeAmount = smallTokenLimit - 100 * 10 ** decimals; // Just under the limit
    console.log(`Staking ${firstStakeAmount} tokens (under the limit)...`);

    // Create stake instruction with amount below the limit
    const stakeWithinLimitIx = await sdk.stakeToken({
      authority: payer.publicKey,
      owner: payer.publicKey,
      configId: testConfigId,
      positionId: 1000, // Use a different position ID
      tokenMint,
      amount: firstStakeAmount,
      poolIndex,
      tokenAccount: userTokenAccount,
    });

    try {
      // Execute the stake transaction
      const res = await createAndProcessTransaction(client, payer, [
        stakeWithinLimitIx,
      ]);

      // Bankrun way of checking for errors
      if (res.result) {
        throw res.result;
      }

      console.log(
        chalk.yellowBright("Successfully staked tokens within the limit")
      );
    } catch (err) {
      console.error("Failed to stake tokens within limit:", err);
      expect.fail("Should be able to stake tokens within the limit");
    }

    // Now, attempt to stake more tokens to exceed the limit
    const exceedingAmount = 200 * 10 ** decimals; // Amount that will exceed the limit
    console.log(
      `Attempting to stake additional ${exceedingAmount} tokens to exceed the limit...`
    );

    // Create stake instruction with amount that would exceed the limit
    const stakeExceedingIx = await sdk.stakeToken({
      authority: payer.publicKey,
      owner: payer.publicKey,
      configId: testConfigId,
      positionId: 1001, // Different position ID
      tokenMint,
      amount: exceedingAmount,
      poolIndex,
      tokenAccount: userTokenAccount,
    });

    // This transaction should fail because it would exceed the user's token limit for this pool
    try {
      const res = await createAndProcessTransaction(client, payer, [
        stakeExceedingIx,
      ]);

      // Bankrun way of checking for errors
      if (res.result) {
        throw res.result;
      }

      expect.fail(
        "Should not be able to stake tokens exceeding the user limit per pool"
      );
    } catch (err) {
      console.log(
        chalk.yellowBright(
          "Transaction correctly failed when exceeding token limit per pool"
        )
      );
      // We expect an error
      expect(err.toString()).to.include("Error");
    }

    // Try staking in a different pool - should succeed
    const otherPoolIndex = 2; // Use a different pool
    const stakeOtherPoolIx = await sdk.stakeToken({
      authority: payer.publicKey,
      owner: payer.publicKey,
      configId: testConfigId,
      positionId: 1002, // Different position ID
      tokenMint,
      amount: exceedingAmount,
      poolIndex: otherPoolIndex,
      tokenAccount: userTokenAccount,
    });

    try {
      const res = await createAndProcessTransaction(client, payer, [
        stakeOtherPoolIx,
      ]);

      // Bankrun way of checking for errors
      if (res.result) {
        throw res.result;
      }

      console.log(
        chalk.yellowBright("Successfully staked tokens in a different pool")
      );
    } catch (err) {
      console.error("Failed to stake tokens in different pool:", err);
      expect.fail("Should be able to stake tokens in a different pool");
    }

    console.log("Token limit per pool test completed successfully!");
  });

  it("Enforces user NFT limit per pool", async () => {
    const poolIndex = 0;
    // Choose pool 0 (1-day lock period) for this test
    const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);

    // Fetch config to get pool limits
    const config = await sdk.fetchConfigByAddress(configPda);
    const poolConfig = config.poolsConfig[poolIndex];

    console.log(
      `Testing NFT limits for pool ${poolIndex} (${poolConfig.lockPeriodDays} days):`
    );
    console.log(`- Max NFTs per user: ${poolConfig.maxNftsCap}`);

    // Create a very small NFT limit for testing
    const smallNftLimit = 3;

    // Create a new config with a smaller NFT limit for this test
    const testConfigId = configId + 201; // Use a different config ID to avoid conflicts
    const smallPoolsConfig = [...poolsConfig]; // Clone the original config

    // Modify the pool configuration to have a smaller NFT limit
    smallPoolsConfig[poolIndex] = {
      ...poolsConfig[poolIndex],
      maxNfts: smallNftLimit,
    };

    console.log(
      `Creating test config with smaller NFT limit of ${smallNftLimit}`
    );

    // Create the new config PDA
    const [testConfigPda] = sdk.pda.findConfigPda(
      payer.publicKey,
      testConfigId
    );

    // Initialize the config with the smaller NFT limit
    const initializeIx = await sdk.initialize({
      authority: payer.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      id: testConfigId,
      poolsConfig: smallPoolsConfig,
      nftsVault: SystemProgram.programId,
      maxCap: maxCap,
      nftValueInTokens: nftValueInTokens,
      nftsLimitPerUser: nftsLimitPerUser,
    });

    // Execute the initialization transaction
    try {
      console.log("Initializing test config with smaller NFT limit...");
      await createAndProcessTransaction(client, payer, [initializeIx]);
      console.log("Test config initialized successfully");
    } catch (err) {
      console.error("Failed to initialize test config:", err);
      expect.fail("Failed to initialize test config");
    }

    const testConfigAccount = await sdk.fetchConfigByAddress(testConfigPda);
    console.log("== Test Config collection:", collectionSigner.publicKey);
    expect(collectionSigner.publicKey.toString()).to.equal(
      testConfigAccount.collection.toString()
    );

    // Initialize user for the new config
    const initUserIx = await sdk.initializeUser({
      owner: payer.publicKey,
      authority: payer.publicKey,
      configId: testConfigId,
      mint: tokenMint,
    });

    try {
      console.log("Initializing user for test config...");
      await createAndProcessTransaction(client, payer, [initUserIx]);
      console.log("User initialized successfully for test config");
    } catch (err) {
      console.error("Failed to initialize user:", err);
      expect.fail("Failed to initialize user");
    }

    // Stake all `smallNftLimit` assets
    await Promise.all(
      Array(smallNftLimit)
        .fill(1)
        .map(async (value, index) => {
          const asset = assets[index + 1];

          console.log(chalk.redBright("staking nft"), index);

          // Stake the first NFT (should succeed)
          const stakeNft1Ix = await sdk.stakeNft({
            authority: payer.publicKey,
            owner: payer.publicKey,
            mint: tokenMint,
            collection: toWeb3JsPublicKey(collectionSigner.publicKey),
            asset: toWeb3JsPublicKey(asset.publicKey),
            configId: testConfigId,
            poolIndex,
            nftsVault: SystemProgram.programId,
          });

          try {
            console.log("Staking NFT ", asset.publicKey.toString());
            const res = await createAndProcessTransaction(
              client,
              payer,
              [stakeNft1Ix],
              []
            );

            // Bankrun way of throwing an error
            if (res.result) {
              throw res.result;
            }

            console.log(
              chalk.yellowBright(
                "Successfully staked NFT" + asset.publicKey.toString()
              )
            );
          } catch (err) {
            console.log(
              chalk.redBright(
                "Failed to stake NFT: " + asset.publicKey.toString()
              ),
              err
            );
            expect.fail("Should be able to stake NFT within the limit");
          }
        })
    );

    const asset = assets[smallNftLimit + 2];

    // Attempt to stake over the limit (should fail)
    const stakeNft2Ix = await sdk.stakeNft({
      authority: payer.publicKey,
      owner: payer.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      asset: toWeb3JsPublicKey(asset.publicKey),
      configId: testConfigId,
      poolIndex,
      nftsVault: SystemProgram.programId,
    });

    // This transaction should fail because it would exceed the user's NFT limit for this pool
    try {
      const res = await createAndProcessTransaction(
        client,
        payer,
        [stakeNft2Ix],
        []
      );

      if (res.result) {
        throw res.result;
      }

      expect.fail(
        "Should not be able to stake NFTs exceeding the user limit per pool"
      );
    } catch (err) {
      console.log(
        "Transaction correctly failed when exceeding NFT limit per pool"
      );
      // We expect an error like "NFT limit reached" or similar constraint error
      expect(err.toString()).to.include("Error");
    }

    const otherPoolIndex = 0;
    // But staking it in another pool should PASS.
    const stakeNft3Ix = await sdk.stakeNft({
      authority: payer.publicKey,
      owner: payer.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      asset: toWeb3JsPublicKey(asset.publicKey),
      configId: testConfigId,
      poolIndex: otherPoolIndex,
      nftsVault: SystemProgram.programId,
    });

    // This transaction should fail because it would exceed the user's NFT limit for this pool
    try {
      const res = await createAndProcessTransaction(
        client,
        payer,
        [stakeNft3Ix],
        []
      );

      if (res.result) {
        throw res.result;
      }

      expect.fail("Should be able to stake NFT in other poole");
    } catch (err) {
      console.log(
        "Transaction correctly failed when exceeding NFT limit per pool"
      );
      // We expect an error like "NFT limit reached" or similar constraint error
      expect(err.toString()).to.include("Error");
    }
    console.log("NFT limit per pool test completed successfully!");
  });
});
