import { Command } from "commander";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";

/**
 * Initialize a pool for the staking program
 */
export function initializePoolCommand(program: Command): void {
  program
    .command("initialize-pool")
    .description("Initialize a new pool for the BERT staking program")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option("-i, --index <number>", "Pool index (0-based)", undefined)
    .option("-d, --lock-period-days <number>", "Lock period in days", undefined)
    .option(
      "-y, --yield-rate <number>",
      "Yield rate in basis points (e.g., 500 = 5%)",
      undefined
    )
    .option(
      "-mn, --max-nfts <number>",
      "Maximum NFTs capacity for the pool",
      "1000"
    )
    .option(
      "-mt, --max-tokens <number>",
      "Maximum tokens capacity for the pool",
      "1000000000"
    )
    .option(
      "-mv, --max-value <number>",
      "Maximum total value capacity for the pool (tokens + NFTs * NFT value)",
      "2000000000"
    )
    .action(async (options) => {
      try {
        const spinner = ora("Initializing staking pool...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse configuration ID
        const configId = parseInt(options.configId);

        // Find the config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Try to fetch the config to make sure it exists
        const config = await sdk.fetchConfigByAddress(configPda);
        if (!config) {
          spinner.fail(
            `Configuration not found. Please initialize the program with config ID ${configId} first.`
          );
          return;
        }

        // Get token mint and decimals
        const mint = config.mint;
        const decimals = await getMint(connection, mint).then(
          (m) => m.decimals
        );

        // Validate required parameters
        if (options.index === undefined) {
          spinner.fail("Pool index is required. Use --index or -i option.");
          return;
        }

        if (options.lockPeriodDays === undefined) {
          spinner.fail(
            "Lock period in days is required. Use --lock-period-days or -d option."
          );
          return;
        }

        if (options.yieldRate === undefined) {
          spinner.fail(
            "Yield rate is required. Use --yield-rate or -y option."
          );
          return;
        }

        // Parse pool parameters
        const poolIndex = parseInt(options.index);
        const lockPeriodDays = parseInt(options.lockPeriodDays);
        const yieldRate = parseInt(options.yieldRate);
        const maxNftsCap = parseInt(options.maxNfts);
        const maxTokensCap = parseInt(options.maxTokens) * 10 ** decimals;
        const maxValueCap = parseInt(options.maxValue) * 10 ** decimals;

        // Find the Pool PDA for this index
        const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
        spinner.text = `Pool PDA: ${poolPda.toString()}`;

        // Check if the pool already exists
        try {
          const existingPool = await sdk.fetchPoolByAddress(poolPda);
          if (existingPool) {
            spinner.fail(
              `Pool with index ${poolIndex} already exists. Use a different index.`
            );
            return;
          }
        } catch (error) {
          // Pool doesn't exist, which is what we want
        }

        // Initialize the pool
        spinner.text = `Initializing pool ${poolIndex}...`;

        try {
          // Use the SDK's RPC method which handles transaction creation and sending
          const txId = await sdk.initializePoolRpc({
            authority: wallet.publicKey,
            configId,
            index: poolIndex,
            lockPeriodDays,
            yieldRate,
            maxNftsCap,
            maxTokensCap,
            maxValueCap,
          });

          spinner.succeed(`Pool ${poolIndex} initialized successfully`);
          console.log(`Transaction: ${txId}`);

          // Short delay to ensure pool is available
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Fetch and display the pool
          const pool = await sdk.fetchPoolByAddress(poolPda);

          if (!pool) {
            console.log("Could not find pool at address:", poolPda.toString());
            return;
          }

          console.log("\nPool Configuration:");
          console.log(`- Index: ${pool.index}`);
          console.log(`- Config: ${pool.config.toString()}`);
          console.log(`- Lock Period: ${pool.lockPeriodDays} days`);
          console.log(`- Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
          console.log(`- Max NFTs: ${pool.maxNftsCap}`);
          console.log(
            `- Max Tokens: ${
              pool.maxTokensCap.toNumber() / 10 ** decimals
            } tokens`
          );
          console.log(
            `- Max Value: ${
              pool.maxValueCap.toNumber() / 10 ** decimals
            } tokens`
          );
          console.log(`- Paused: ${pool.isPaused ? "Yes" : "No"}`);
          console.log(
            `- Equivalent APY: ${(
              (pool.yieldRate.toNumber() / 100) *
              (365 / pool.lockPeriodDays)
            ).toFixed(2)}%`
          );

          // Calculate and display stats
          console.log("\nPool Statistics:");
          console.log(`- Current NFTs Staked: ${pool.totalNftsStaked}`);
          console.log(
            `- Current Tokens Staked: ${
              pool.totalTokensStaked.toNumber() / 10 ** decimals
            }`
          );
          console.log(`- Lifetime NFTs Staked: ${pool.lifetimeNftsStaked}`);
          console.log(
            `- Lifetime Tokens Staked: ${
              pool.lifetimeTokensStaked.toNumber() / 10 ** decimals
            }`
          );
          console.log(
            `- Lifetime Yield Claimed: ${
              pool.lifetimeClaimedYield.toNumber() / 10 ** decimals
            }`
          );
        } catch (error) {
          spinner.fail(`Failed to initialize pool: ${error}`);
          console.error(error);
        }
      } catch (error) {
        ora().fail(`An error occurred: ${error}`);
        console.error(error);
      }
    });
}
