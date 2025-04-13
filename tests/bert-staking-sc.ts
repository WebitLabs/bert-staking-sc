import { config, expect } from "chai";
import { prelude } from "./helpers/prelude";
import { Keypair, PublicKey } from "@solana/web3.js";
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
  toWeb3JsKeypair,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { PoolConfigParams } from "@bert-staking/sdk/src/utils";

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
  const maxCap = 1_000_000_000; // 1 billion tokens
  const nftValueInTokens = 100_000; // 100k tokens per NFT
  const nftsLimitPerUser = 5; // 5 NFTs max per user

  // Token staking parameters
  let userTokenAccount: PublicKey;

  // let collection = new PublicKey(B_COLLECTION);
  // let asset = new PublicKey(B_545_ASSET);
  let decimals: number;

  let collectionSigner: KeypairSigner;
  let assetSigner: KeypairSigner;

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
      "B_COLLECTION"
    );

    collectionSigner = result.collection;
    assetSigner = result.asset;
  });

  it("Initializes the Bert staking program with custom pool configurations", async () => {
    let authority = payer;
    console.log("Authority:", authority.publicKey.toString());

    const [configPda] = sdk.pda.findConfigPda(authority.publicKey, configId);
    console.log("Config PDA:", configPda.toString());

    // Get vault ATA for the config
    const vaultTA = getAssociatedTokenAddressSync(tokenMint, configPda, true);

    // Initialize the staking program with pool configurations
    const initializeIx = await sdk.initialize({
      authority: authority.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      id: configId,
      poolsConfig,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });

    let configAccount: ConfigIdl;
    try {
      await createAndProcessTransaction(client, authority, [initializeIx]);
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
      const mintAmount = 1_000 * 10 ** decimals;
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
  //
  // it("Stakes a Metaplex Core asset successfully", async () => {
  //   const poolIndex = 3;
  //
  //   // Get the Config PDA and account data with our configId
  //   const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
  //   const configAccount = await sdk.fetchConfigByAddress(configPda);
  //
  //   // NOTE: You no longer need to init position.
  //
  //   // try {
  //   //   // Use a distinct position ID for the NFT stake
  //   //
  //   //   // First, initialize the position for the NFT
  //   //   console.log("Initializing position for NFT staking...");
  //   //   const initPositionIx = await sdk.initializePosition({
  //   //     authority: payer.publicKey,
  //   //     owner: payer.publicKey,
  //   //     tokenMint,
  //   //     configId,
  //   //     positionId: nftPositionId,
  //   //     lockPeriodYieldIndex,
  //   //     positionType: PositionType.NFT,
  //   //   });
  //   //
  //   //   // Process the initialize position transaction
  //   //   await createAndProcessTransaction(client, payer, [initPositionIx]);
  //   //   console.log("NFT position initialized successfully");
  //   // } catch (err) {
  //   //   console.error("Failed to stake NFT:", err);
  //   //   expect.fail(`NFT staking failed: ${err}`);
  //   // }
  //
  //   console.log("Staking a single Metaplex Core asset...");
  //   console.log("Owner:", payer.publicKey.toString());
  //   console.log("Asset:", assetSigner.publicKey.toString());
  //   console.log("Collection:", collectionSigner.publicKey.toString());
  //
  //   // Find the Position PDA for this owner, mint and positionId
  //   const [positionPda] = sdk.pda.findPositionPda(
  //     payer.publicKey,
  //     tokenMint,
  //     nftPositionId
  //   );
  //   console.log("Position PDA:", positionPda.toString());
  //
  //   // Create the stake NFT instruction
  //   const stakeNftIx = await sdk.stakeNft({
  //     authority: payer.publicKey,
  //     owner: payer.publicKey,
  //     mint: tokenMint,
  //     collection: toWeb3JsPublicKey(collectionSigner.publicKey),
  //     asset: toWeb3JsPublicKey(assetSigner.publicKey),
  //     updateAuthority: payer.publicKey,
  //     payer: payer.publicKey,
  //     configId,
  //     poolIndex,
  //   });
  //
  //   // Process the transaction
  //   await createAndProcessTransaction(
  //     client,
  //     payer,
  //     [stakeNftIx],
  //     [toWeb3JsKeypair(collectionSigner)]
  //   );
  //   console.log("NFT staked successfully");
  //
  //   // Verify the position was updated correctly
  //   const position = await sdk.fetchPosition(
  //     payer.publicKey,
  //     nftPositionId,
  //     tokenMint
  //   );
  //
  //   expect(position).to.not.be.null;
  //   expect(position.owner.toString()).to.equal(payer.publicKey.toString());
  //   expect(position.positionType).to.deep.equal({ nft: {} });
  //   expect(position.amount.toNumber()).to.equal(nftValueInTokens);
  //   expect(position.lockPeriodYieldIndex).to.equal(poolIndex);
  //
  //   // Verify the staked NFT is in the position's nft_mints array
  //   expect(position.nftMints[0].toString()).to.equal(
  //     assetSigner.publicKey.toString()
  //   );
  //   expect(position.nftIndex).to.equal(1); // Should have 1 NFT staked
  //
  //   console.log("Position after staking NFT:");
  //   console.log("- Owner:", position.owner.toString());
  //   console.log("- Amount:", position.amount.toString());
  //   console.log("- Position Type:", position.positionType);
  //   console.log("- Lock Period Yield Index:", position.lockPeriodYieldIndex);
  //   console.log("- NFT Index:", position.nftIndex);
  //   console.log("- NFT Mint:", position.nftMints[0].toString());
  //
  //   // Verify config total staked amount increased
  //   const updatedConfig = await sdk.fetchConfigByAddress(configPda);
  //   const expectedTotalStaked =
  //     configAccount.totalStakedAmount.toNumber() + nftValueInTokens;
  //   expect(updatedConfig.totalStakedAmount.toNumber()).to.equal(
  //     expectedTotalStaked
  //   );
  //
  //   console.log(
  //     "Total staked amount updated:",
  //     updatedConfig.totalStakedAmount.toString()
  //   );
  //
  //   const assetData = await getMplCoreAsset(
  //     client,
  //     toWeb3JsPublicKey(assetSigner.publicKey)
  //   );
  //
  //   // Verify the asset has been updated with staking attributes
  //   if (assetData.pluginHeader) {
  //     console.log("Asset pluginHeaders after staking:", assetData.pluginHeader);
  //
  //     // Check if the FreezeDelegate pluginHeader was added and asset is frozen
  //     expect(assetData.freezeDelegate).to.not.be.undefined;
  //     expect(assetData.freezeDelegate.frozen).to.be.true;
  //     console.log(
  //       "Asset successfully frozen:",
  //       assetData.freezeDelegate.frozen
  //     );
  //
  //     // Check if attributes plugin was added with staking information
  //     expect(assetData.attributes).to.not.be.undefined;
  //     const stakedAttr = assetData.attributes.attributeList.find(
  //       (attr) => attr.key === "staked"
  //     );
  //     expect(stakedAttr).to.not.be.undefined;
  //     expect(stakedAttr.value).to.not.equal("0"); // TODO: Verify that timestamp matches the indeShould contain a timestamp
  //     console.log("Staking attribute added:", stakedAttr);
  //
  //     const stakedTimeAttr = assetData.attributes.attributeList.find(
  //       (attr) => attr.key === "staked_time"
  //     );
  //     expect(stakedTimeAttr).to.not.be.undefined;
  //     console.log("Staked time attribute:", stakedTimeAttr);
  //   }
  // });
});
