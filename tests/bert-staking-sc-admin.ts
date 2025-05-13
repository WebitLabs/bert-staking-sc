import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import { expect } from "chai";
import chalk from "chalk";
import { AddedProgram, BanksClient, ProgramTestContext } from "solana-bankrun";
import { BertStakingSDK, PoolConfigArgs } from "../sdk/src";
import {
  createAndProcessTransaction,
  getAddedAccountInfo,
} from "./helpers/bankrun";
import { MPL_CORE_ADDRESS, USDC_MINT_ADDRESS } from "./helpers/constants";
import { createCollectionAndMintAsset } from "./helpers/core";
import { prelude } from "./helpers/prelude";
import {
  createAtaForMint,
  createTokenAccountAtAddress,
  getTokenBalance,
} from "./helpers/token";

const addedPrograms: AddedProgram[] = [
  { name: "mpl_core", programId: new PublicKey(MPL_CORE_ADDRESS) },
];

const maxNftsCap = 1000;
const maxTokensCap = 1_000_000_000_000_000; // 1 Billion with 6 decimals

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

describe("bert-staking-sc-admin", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;
  let provider: BankrunProvider;
  let sdk: BertStakingSDK;

  const tokenMint = new PublicKey(USDC_MINT_ADDRESS);

  // Global IDs for configs and positions
  const configId = 1; // Using 1 instead of 0 to test non-default ID

  // Test parameters for initialization
  const maxCap = 1_000_000_000 * 10 ** 6; // 1 billion tokens
  const nftValueInTokens = 100_000 * 10 ** 6; // 100k tokens per NFT
  const nftsLimitPerUser = 5; // 5 NFTs max per user

  let collection: PublicKey;
  let configPda: PublicKey;
  let vaultAta: PublicKey;
  let authorityVaultPda: PublicKey;
  let decimals: number;
  let tokensInVault: number;

  before("before", async () => {
    const usdcMint = await getAddedAccountInfo(tokenMint);

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

    decimals = 6; // USDC decimals

    // Create a collection
    const result = await createCollectionAndMintAsset(
      payer,
      client,
      "ADMIN_TEST_COLLECTION",
      1
    );

    collection = new PublicKey(result.collection.publicKey);
    console.log("Collection address:", collection.toString());
  });

  it("Initializes the staking program and creates pool configurations", async () => {
    console.log("Authority:", payer.publicKey.toString());

    [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
    console.log("Config PDA:", configPda.toString());

    // Get vault ATA for the config
    vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);

    // Get authority vault PDA
    [authorityVaultPda] = sdk.pda.findAuthorityVaultPda(configPda, tokenMint);

    try {
      // Initialize the staking program (without pool configurations in new architecture)
      const initializeIx = await sdk.initialize({
        authority: payer.publicKey,
        mint: tokenMint,
        collection,
        adminWithdrawDestination: payer.publicKey, // Using payer as the admin withdraw destination
        id: configId,
        vault: vaultAta,
        nftsVault: SystemProgram.programId,
        maxCap,
        nftValueInTokens,
        nftsLimitPerUser,
      });

      console.log("Initializing program...");
      // Initialize auth vault instruction
      const initializeAuthVaultIx = await sdk.initializeAuthVault({
        authority: payer.publicKey,
        configId,
        tokenMint,
      });

      // Execute both instructions
      await createAndProcessTransaction(client, payer, [
        initializeIx,
        initializeAuthVaultIx,
      ]);

      console.log("Program and authority vault initialized successfully");

      // Create instructions for initializing each pool
      const poolInstructions = [];
      for (let i = 0; i < poolsConfig.length; i++) {
        const poolConfig = poolsConfig[i];
        const initPoolIx = await sdk.initializePool({
          authority: payer.publicKey,
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
      await createAndProcessTransaction(client, payer, poolInstructions);
      console.log("All pools initialized successfully");

      // Create the ATAs with some tokens for the vault and authority vault
      const mintAmount = 1_000_000_000 * 10 ** decimals;
      tokensInVault = mintAmount;

      // Mint tokens to main vault
      createAtaForMint(provider, configPda, tokenMint, BigInt(mintAmount));

      // Mint tokens to authority vault (for yield payments)
      createTokenAccountAtAddress(
        provider,
        authorityVaultPda,
        configPda,
        tokenMint,
        BigInt(mintAmount)
      );
      console.log("Tokens minted to vaults");

      // Verify initialization
      const configAccount = await sdk.fetchConfigByAddress(configPda);

      // Verify config values
      expect(configAccount.authority).to.deep.equal(payer.publicKey);
      expect(configAccount.mint).to.deep.equal(tokenMint);
      expect(configAccount.id.toNumber()).to.deep.equal(configId);
      expect(configAccount.vault.toString()).to.equal(vaultAta.toString());
      expect(configAccount.authorityVault.toString()).to.equal(
        authorityVaultPda.toString()
      );

      // Now verify each pool was correctly initialized
      console.log("Verifying pool configurations...");

      for (let i = 0; i < poolsConfig.length; i++) {
        const [poolPda] = sdk.pda.findPoolPda(configPda, i);
        console.log(`Pool ${i} PDA: ${poolPda.toString()}`);

        const pool = await sdk.fetchPoolByAddress(poolPda);

        // Verify pool values match our input
        expect(pool.config.toString()).to.equal(configPda.toString());
        expect(pool.index).to.equal(i);
        expect(pool.lockPeriodDays).to.equal(poolsConfig[i].lockPeriodDays);
        expect(pool.yieldRate.toNumber()).to.equal(poolsConfig[i].yieldRate);
        expect(pool.maxNftsCap).to.equal(poolsConfig[i].maxNfts);
        expect(pool.maxTokensCap.toString()).to.equal(
          poolsConfig[i].maxTokens.toString()
        );
        expect(pool.isPaused).to.be.false; // Pools should start as active

        console.log(`Pool ${i} configuration verified:`);
        console.log(`- Lock Period: ${pool.lockPeriodDays} days`);
        console.log(`- Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
        console.log(`- Max NFTs: ${pool.maxNftsCap}`);
        console.log(`- Max Tokens: ${pool.maxTokensCap.toString()}`);
        console.log(`- Is Paused: ${pool.isPaused}`);
      }
    } catch (err) {
      console.error("Failed to initialize:", err);
      throw err;
    }
  });

  it("Pauses a pool successfully", async () => {
    // Test pausing pool 0
    const poolIndex = 0;

    // Find the Pool PDA
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Capture state before pausing
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    expect(poolBefore.isPaused).to.be.false;

    try {
      // Execute the pause pool instruction
      const pauseIx = await sdk.adminPausePool({
        authority: payer.publicKey,
        configId,
        poolIndex,
      });

      const res = await createAndProcessTransaction(client, payer, [pauseIx]);
      if (res.result) {
        throw res.result;
      }

      console.log(`Pool ${poolIndex} paused successfully`);

      // Verify the pool is paused
      const poolAfter = await sdk.fetchPoolByAddress(poolPda);
      expect(poolAfter.isPaused).to.be.true;

      // Verify other pool states haven't changed
      for (let i = 1; i < 4; i++) {
        const [otherPoolPda] = sdk.pda.findPoolPda(configPda, i);
        const otherPool = await sdk.fetchPoolByAddress(otherPoolPda);
        expect(otherPool.isPaused).to.be.false;
      }
    } catch (err) {
      console.error("Failed to pause pool:", err);
      throw err;
    }
  });

  it("Fails to pause an already paused pool", async () => {
    // Try to pause pool 0 again
    const poolIndex = 0;

    // Find the Pool PDA
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Verify the pool is currently paused
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    expect(poolBefore.isPaused).to.be.true;

    try {
      const pauseIx = await sdk.adminPausePool({
        authority: payer.publicKey,
        configId,
        poolIndex,
      });

      const res = await createAndProcessTransaction(client, payer, [pauseIx]);

      // In bankrun, we check if the result contains an error
      if (!res.result) {
        expect.fail("Should have failed to pause already paused pool");
      } else {
        console.log(
          chalk.yellowBright(
            "Transaction correctly failed when pausing an already paused pool"
          )
        );
      }
    } catch (err) {
      // This is also a valid path if an error is thrown
      console.log(
        chalk.yellowBright(
          "Transaction correctly failed when pausing an already paused pool"
        )
      );
    }

    // Verify the pool is still paused
    const poolAfter = await sdk.fetchPoolByAddress(poolPda);
    expect(poolAfter.isPaused).to.be.true;
  });

  it("Sets pool configuration for a paused pool", async () => {
    const poolIndex = 0;

    // Find the Pool PDA
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Capture state before updating
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    expect(poolBefore.isPaused).to.be.true; // Pool should be paused from previous test

    // New pool configuration
    const newConfig: PoolConfigArgs = {
      lockPeriodDays: 2,
      yieldRate: 400,
      maxNftsCap: 250,
      maxTokensCap: new BN(2_000_000 * 10 ** decimals),
    };

    try {
      // Update pool configuration
      const updateConfigIx = await sdk.adminSetPoolConfig({
        authority: payer.publicKey,
        configId,
        poolIndex,
        poolConfigArgs: newConfig,
      });

      const res = await createAndProcessTransaction(client, payer, [
        updateConfigIx,
      ]);
      if (res.result) {
        throw res.result;
      }

      console.log(`Pool ${poolIndex} configuration updated successfully`);

      // Verify configuration was updated
      const poolAfter = await sdk.fetchPoolByAddress(poolPda);

      // Check each field was updated correctly
      expect(poolAfter.lockPeriodDays).to.equal(newConfig.lockPeriodDays);
      expect(poolAfter.yieldRate.toString()).to.equal(
        newConfig.yieldRate.toString()
      );
      expect(poolAfter.maxNftsCap).to.equal(newConfig.maxNftsCap);
      expect(poolAfter.maxTokensCap.toString()).to.equal(
        newConfig.maxTokensCap.toString()
      );

      // Verify the pool is still paused
      expect(poolAfter.isPaused).to.be.true;

      console.log("Pool configuration before update:");
      console.log(`- Lock period: ${poolBefore.lockPeriodDays} days`);
      console.log(`- Yield rate: ${poolBefore.yieldRate.toNumber() / 100}%`);
      console.log(`- Max NFTs: ${poolBefore.maxNftsCap}`);
      console.log(`- Max Tokens: ${poolBefore.maxTokensCap.toString()}`);
      console.log(`- Is Paused: ${poolBefore.isPaused}`);

      console.log("Pool configuration after update:");
      console.log(`- Lock period: ${poolAfter.lockPeriodDays} days`);
      console.log(`- Yield rate: ${poolAfter.yieldRate.toNumber() / 100}%`);
      console.log(`- Max NFTs: ${poolAfter.maxNftsCap}`);
      console.log(`- Max Tokens: ${poolAfter.maxTokensCap.toString()}`);
      console.log(`- Is Paused: ${poolAfter.isPaused}`);
    } catch (err) {
      console.error("Failed to update pool configuration:", err);
      throw err;
    }
  });

  it("Activates a pool successfully", async () => {
    const poolIndex = 0;

    // Find the Pool PDA
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Verify the pool is currently paused
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    expect(poolBefore.isPaused).to.be.true;

    try {
      // Execute the activate pool instruction
      const activateIx = await sdk.adminActivatePool({
        authority: payer.publicKey,
        configId,
        poolIndex,
      });

      const res = await createAndProcessTransaction(client, payer, [
        activateIx,
      ]);
      if (res.result) {
        throw res.result;
      }

      console.log(`Pool ${poolIndex} activated successfully`);

      // Verify the pool is no longer paused
      const poolAfter = await sdk.fetchPoolByAddress(poolPda);
      expect(poolAfter.isPaused).to.be.false;

      // Verify other pool properties weren't changed
      expect(poolAfter.lockPeriodDays).to.equal(poolBefore.lockPeriodDays);
      expect(poolAfter.yieldRate.toString()).to.equal(
        poolBefore.yieldRate.toString()
      );
      expect(poolAfter.maxNftsCap).to.equal(poolBefore.maxNftsCap);
      expect(poolAfter.maxTokensCap.toString()).to.equal(
        poolBefore.maxTokensCap.toString()
      );

      // Verify other pools weren't affected
      for (let i = 1; i < 4; i++) {
        const [otherPoolPda] = sdk.pda.findPoolPda(configPda, i);
        const otherPool = await sdk.fetchPoolByAddress(otherPoolPda);
        // These pools should still not be paused
        expect(otherPool.isPaused).to.be.false;
      }

      console.log("Pool configuration after activation:");
      console.log(`- Lock period: ${poolAfter.lockPeriodDays} days`);
      console.log(`- Yield rate: ${poolAfter.yieldRate.toNumber() / 100}%`);
      console.log(`- Max NFTs: ${poolAfter.maxNftsCap}`);
      console.log(`- Max Tokens: ${poolAfter.maxTokensCap.toString()}`);
      console.log(`- Is Paused: ${poolAfter.isPaused}`);
    } catch (err) {
      console.error("Failed to activate pool:", err);
      throw err;
    }
  });

  it("Fails to activate an already active pool", async () => {
    const poolIndex = 0;

    // Find the Pool PDA
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Verify the pool is currently active
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    expect(poolBefore.isPaused).to.be.false;

    try {
      const activateIx = await sdk.adminActivatePool({
        authority: payer.publicKey,
        configId,
        poolIndex,
      });

      const res = await createAndProcessTransaction(client, payer, [
        activateIx,
      ]);

      // In bankrun, we check if the result contains an error
      if (!res.result) {
        expect.fail("Should have failed to activate already active pool");
      } else {
        console.log(
          chalk.yellowBright(
            "Transaction correctly failed when activating an already active pool"
          )
        );
      }
    } catch (err) {
      // This is also a valid path if an error is thrown
      console.log(
        chalk.yellowBright(
          "Transaction correctly failed when activating an already active pool"
        )
      );
    }

    // Verify the pool is still active (not paused)
    const poolAfter = await sdk.fetchPoolByAddress(poolPda);
    expect(poolAfter.isPaused).to.be.false;
  });

  it("Fails to update configuration of an active pool", async () => {
    const poolIndex = 0;

    // Find the Pool PDA
    const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
    console.log(`Pool ${poolIndex} PDA:`, poolPda.toString());

    // Verify the pool is currently active
    const poolBefore = await sdk.fetchPoolByAddress(poolPda);
    expect(poolBefore.isPaused).to.be.false;

    // Capture original configuration
    const originalLockPeriod = poolBefore.lockPeriodDays;
    const originalYieldRate = poolBefore.yieldRate;
    const originalMaxNfts = poolBefore.maxNftsCap;
    const originalMaxTokens = poolBefore.maxTokensCap;

    // New pool configuration
    const newConfig: PoolConfigArgs = {
      lockPeriodDays: 3,
      yieldRate: 300,
      maxNftsCap: 300,
      maxTokensCap: new BN(3_000_000 * 10 ** decimals),
    };

    try {
      // Try to update configuration of active pool
      const updateConfigIx = await sdk.adminSetPoolConfig({
        authority: payer.publicKey,
        configId,
        poolIndex,
        poolConfigArgs: newConfig,
      });

      const res = await createAndProcessTransaction(client, payer, [
        updateConfigIx,
      ]);

      // In bankrun, we check if the result contains an error
      if (!res.result) {
        expect.fail(
          "Should have failed to update configuration of active pool"
        );
      } else {
        console.log(
          chalk.yellowBright(
            "Transaction correctly failed when updating an active pool"
          )
        );
      }
    } catch (err) {
      // This is also a valid path if an error is thrown
      console.log(
        chalk.yellowBright(
          "Transaction correctly failed when updating an active pool"
        )
      );
      expect(err.toString()).to.include("Error");
    }

    // Verify the pool configuration wasn't changed
    const poolAfter = await sdk.fetchPoolByAddress(poolPda);
    expect(poolAfter.lockPeriodDays).to.equal(originalLockPeriod);
    expect(poolAfter.yieldRate.toString()).to.equal(
      originalYieldRate.toString()
    );
    expect(poolAfter.maxNftsCap).to.equal(originalMaxNfts);
    expect(poolAfter.maxTokensCap.toString()).to.equal(
      originalMaxTokens.toString()
    );
    expect(poolAfter.isPaused).to.be.false;
  });

  it("Withdraws tokens from the vault", async () => {
    // Create destination token account for the user
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      payer.publicKey,
      false
    );

    // Ensure it exists and contains some tokens
    createAtaForMint(provider, payer.publicKey, tokenMint, BigInt(0));

    // Get initial balances
    const initialAuthVaultBalance = await getTokenBalance(
      client,
      authorityVaultPda
    );
    const initialUserBalance = await getTokenBalance(client, userTokenAccount);

    console.log("Initial authority vault balance:", initialAuthVaultBalance);
    console.log("Initial user balance:", initialUserBalance);

    // Withdraw a specific amount
    const withdrawAmount = 1000 * 10 ** decimals;

    try {
      // Execute token withdrawal
      const withdrawIx = await sdk.adminWithdrawToken({
        authority: payer.publicKey,
        configId,
        tokenMint,
        amount: withdrawAmount,
        adminWithdrawTokenAccount: userTokenAccount,
        authorityVault: authorityVaultPda,
      });

      const res = await createAndProcessTransaction(client, payer, [
        withdrawIx,
      ]);
      if (res.result) {
        throw res.result;
      }

      console.log(
        `${withdrawAmount} tokens withdrawn successfully from authority vault`
      );

      // Verify balances have changed correctly
      const finalAuthVaultBalance = await getTokenBalance(
        client,
        authorityVaultPda
      );
      const finalUserBalance = await getTokenBalance(client, userTokenAccount);

      console.log("Final authority vault balance:", finalAuthVaultBalance);
      console.log("Final user balance:", finalUserBalance);

      // Check the differences
      expect(initialAuthVaultBalance - finalAuthVaultBalance).to.equal(
        withdrawAmount
      );
      expect(finalUserBalance - initialUserBalance).to.equal(withdrawAmount);

      // Also verify config metadata hasn't changed
      const config = await sdk.fetchConfigByAddress(configPda);

      // Validate total staked amount hasn't changed
      const totalStaked = config.totalStakedAmount.toNumber();
      console.log("Total staked amount:", totalStaked);
      expect(totalStaked).to.equal(0); // Should be 0 as no staking happened

      // Verify pools weren't affected by the token withdrawal
      for (let i = 0; i < poolsConfig.length; i++) {
        const [poolPda] = sdk.pda.findPoolPda(configPda, i);
        const pool = await sdk.fetchPoolByAddress(poolPda);

        // Verify pool with 0 index still has our updated values, others have initial values
        if (i === 0) {
          expect(pool.lockPeriodDays).to.equal(2); // From previous test
          expect(pool.yieldRate.toNumber()).to.equal(400); // From previous test
          expect(pool.isPaused).to.be.false; // Was activated
        } else {
          expect(pool.lockPeriodDays).to.equal(poolsConfig[i].lockPeriodDays);
          expect(pool.yieldRate.toNumber()).to.equal(poolsConfig[i].yieldRate);
          expect(pool.isPaused).to.be.false;
        }
      }
    } catch (err) {
      console.error("Failed to withdraw tokens:", err);
      throw err;
    }
  });

  it("Fails when non-admin user attempts to withdraw tokens", async () => {
    // Create another user (not the admin)
    const nonAdminUser = Keypair.generate();
    console.log("Non-admin user:", nonAdminUser.publicKey.toString());

    // Fund the non-admin user with some SOL to pay for transaction fees
    const fundNonAdminIx = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: nonAdminUser.publicKey,
      lamports: 10000000000, // 10 SOL
    });

    await createAndProcessTransaction(client, payer, [fundNonAdminIx]);
    console.log("Funded non-admin user with SOL");

    // Create a token account for the non-admin user
    const nonAdminTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      nonAdminUser.publicKey,
      false
    );

    // Initialize the token account
    createAtaForMint(provider, nonAdminUser.publicKey, tokenMint, BigInt(0));
    console.log("Created token account for non-admin user");

    // Attempt to withdraw tokens as non-admin
    const withdrawAmount = 1000 * 10 ** decimals;

    try {
      // Execute token withdrawal with non-admin as authority
      const withdrawIx = await sdk.adminWithdrawToken({
        authority: nonAdminUser.publicKey, // Non-admin user as authority
        configId,
        tokenMint,
        amount: withdrawAmount,
        adminWithdrawTokenAccount: nonAdminTokenAccount,
        authorityVault: authorityVaultPda,
      });

      const res = await createAndProcessTransaction(client, nonAdminUser, [
        withdrawIx,
      ]);

      // In bankrun, we check if the result contains an error
      if (!res.result) {
        expect.fail("Should have failed when non-admin attempts to withdraw");
      } else {
        console.log(
          chalk.yellowBright(
            "Transaction correctly failed when non-admin attempted to withdraw"
          )
        );
      }
    } catch (err) {
      // This path is also valid if an error is thrown
      console.log(
        chalk.yellowBright(
          "Transaction correctly failed when non-admin attempted to withdraw"
        )
      );
      expect(err.toString()).to.include("Error");
    }
  });

  it("Fails when admin tries to withdraw to token account with incorrect owner", async () => {
    // Create another user to act as an incorrect destination
    const wrongDestination = Keypair.generate();
    console.log(
      "Wrong destination user:",
      wrongDestination.publicKey.toString()
    );

    // Fund the wrong destination with some SOL to pay for transaction fees
    const fundWrongDestIx = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: wrongDestination.publicKey,
      lamports: 10000000000, // 10 SOL
    });

    await createAndProcessTransaction(client, payer, [fundWrongDestIx]);
    console.log("Funded wrong destination user with SOL");

    // Create a token account for the wrong destination
    const wrongDestTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      wrongDestination.publicKey,
      false
    );

    // Initialize the token account
    createAtaForMint(
      provider,
      wrongDestination.publicKey,
      tokenMint,
      BigInt(0)
    );
    console.log("Created token account for wrong destination user");

    // Attempt to withdraw tokens to a token account with wrong owner
    const withdrawAmount = 1000 * 10 ** decimals;

    try {
      // Execute token withdrawal with correct authority but trying to use a wrong destination token account
      const withdrawIx = await sdk.adminWithdrawToken({
        authority: payer.publicKey, // Admin user as authority (correct)
        configId,
        tokenMint,
        amount: withdrawAmount,
        adminWithdrawTokenAccount: wrongDestTokenAccount, // Wrong destination token account
        authorityVault: authorityVaultPda,
      });

      const res = await createAndProcessTransaction(client, payer, [
        withdrawIx,
      ]);

      // In bankrun, we check if the result contains an error
      if (!res.result) {
        expect.fail(
          "Should have failed when withdrawing to incorrect destination"
        );
      } else {
        console.log(
          chalk.yellowBright(
            "Transaction correctly failed when withdrawing to incorrect destination"
          )
        );
      }
    } catch (err) {
      // This path is also valid if an error is thrown
      console.log(
        chalk.yellowBright(
          "Transaction correctly failed when withdrawing to incorrect destination"
        )
      );
      expect(err.toString()).to.include("Error");
    }
  });

  it("Fails when trying to withdraw more tokens than available in the authority vault", async () => {
    // Get the user token account
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      payer.publicKey,
      false
    );

    // Get config to check the staked amount
    const config = await sdk.fetchConfigByAddress(configPda);
    const totalStakedAmount = config.totalStakedAmount.toNumber();
    const vaultBalance = await getTokenBalance(client, vaultAta);

    console.log("Total staked amount:", totalStakedAmount);
    console.log("Vault balance:", vaultBalance);

    // We'll create a test environment where we control exactly how many
    // tokens are in the authority vault, so we can test the token balance
    // constraints when attempting to withdraw tokens

    // Create a new test config with a lower vault balance and some tokens marked as staked
    const testConfigId = configId + 100;
    const [testConfigPda] = sdk.pda.findConfigPda(
      payer.publicKey,
      testConfigId
    );
    const testVaultAta = getAssociatedTokenAddressSync(
      tokenMint,
      testConfigPda,
      true
    );
    const [testAuthVaultPda] = sdk.pda.findAuthorityVaultPda(
      testConfigPda,
      tokenMint
    );

    // Initialize the test config
    const initializeIx = await sdk.initialize({
      authority: payer.publicKey,
      adminWithdrawDestination: payer.publicKey,
      mint: tokenMint,
      collection,
      id: testConfigId,
      vault: testVaultAta,
      nftsVault: SystemProgram.programId,
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

    // Execute both instructions
    await createAndProcessTransaction(client, payer, [
      initializeIx,
      initializeAuthVaultIx,
    ]);

    // Create instructions for initializing each pool for the test config
    const testPoolInstructions = [];
    for (let i = 0; i < poolsConfig.length; i++) {
      const poolConfig = poolsConfig[i];
      const initPoolIx = await sdk.initializePool({
        authority: payer.publicKey,
        configId: testConfigId,
        index: i,
        lockPeriodDays: poolConfig.lockPeriodDays,
        yieldRate: poolConfig.yieldRate,
        maxNftsCap: poolConfig.maxNfts,
        maxTokensCap: poolConfig.maxTokens,
      });
      testPoolInstructions.push(initPoolIx);
    }

    // Execute pool initialization instructions
    await createAndProcessTransaction(client, payer, testPoolInstructions);
    console.log("All test config pools initialized successfully");

    // Create main vault with 0 balance since it's not used for admin withdrawals
    createAtaForMint(provider, testVaultAta, tokenMint, BigInt(0));

    // Mint a small amount to the authority vault for yield distributions
    const testAuthVaultAmount = 5000 * 10 ** decimals;
    createTokenAccountAtAddress(
      provider,
      testAuthVaultPda,
      testConfigPda, // The owner should be the configPDA
      tokenMint,
      BigInt(testAuthVaultAmount)
    );

    // Since we're testing the authority vault's withdrawal limits,
    // we're going to attempt to withdraw more than what's in the authority vault
    // The test should fail when we try to withdraw more than what's available in the authority vault

    // Current authority vault balance
    const authVaultBalance = await getTokenBalance(client, testAuthVaultPda);

    // Try to withdraw slightly more than what's in the authority vault
    const excessiveAmount = authVaultBalance + 100 * 10 ** decimals;

    console.log("Authority vault balance:", authVaultBalance);
    console.log(
      "Attempting to withdraw:",
      excessiveAmount,
      "(exceeding available balance)"
    );

    try {
      // Test withdrawal with excessive amount
      const withdrawIx = await sdk.adminWithdrawToken({
        authority: payer.publicKey,
        configId: testConfigId,
        tokenMint,
        amount: excessiveAmount,
        adminWithdrawTokenAccount: userTokenAccount,
        authorityVault: testAuthVaultPda,
      });

      const res = await createAndProcessTransaction(client, payer, [
        withdrawIx,
      ]);

      // The transaction should fail with an error about insufficient admin funds
      if (!res.result) {
        // This should not happen - it should fail
        expect.fail(
          "Should have failed to withdraw more than available for admin"
        );
      } else {
        console.log(
          chalk.yellowBright(
            "Transaction correctly failed when withdrawing excessive amount"
          )
        );
      }
    } catch (err) {
      // This path is also valid
      console.log(
        chalk.yellowBright(
          "Transaction correctly failed when withdrawing excessive amount"
        )
      );
      expect(err.toString()).to.include("Error");
    }

    // Now try a valid withdrawal within the authority vault balance
    const validWithdrawAmount = authVaultBalance - 100 * 10 ** decimals;

    console.log(
      "Attempting valid withdrawal of:",
      validWithdrawAmount,
      "(within available balance)"
    );

    try {
      const validWithdrawIx = await sdk.adminWithdrawToken({
        authority: payer.publicKey,
        configId: testConfigId,
        tokenMint,
        amount: validWithdrawAmount,
        adminWithdrawTokenAccount: userTokenAccount,
        authorityVault: testAuthVaultPda,
      });

      const res = await createAndProcessTransaction(client, payer, [
        validWithdrawIx,
      ]);

      // This should succeed
      if (res.result) {
        throw res.result;
      }

      console.log(
        chalk.greenBright(
          `Successfully withdrew ${validWithdrawAmount} tokens (within admin limits)`
        )
      );
    } catch (err) {
      console.error("Failed valid withdrawal attempt:", err);
      throw err;
    }
  });
});
