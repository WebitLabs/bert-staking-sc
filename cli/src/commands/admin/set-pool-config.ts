import { Command } from "commander";
import { getConnection, getSDK, getWallet } from "../../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

/**
 * Command to update pool configuration
 */
export function setPoolConfigCommand(program: Command): void {
  program
    .command("admin:set-pool-config")
    .description("Update a staking pool's configuration (pool must be paused)")
    .requiredOption("-i, --pool-index <number>", "Pool index to update")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option("-l, --lock-days <number>", "Lock period in days")
    .option(
      "-y, --yield-rate <number>",
      "Yield rate in basis points (e.g., 500 = 5%)"
    )
    .option("-mn, --max-nfts <number>", "Maximum NFTs allowed in this pool")
    .option("-mt, --max-tokens <number>", "Maximum tokens allowed in this pool")
    .action(async (options) => {
      try {
        const spinner = ora("Updating pool configuration...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const poolIndex = parseInt(options.poolIndex);
        const configId = parseInt(options.configId);

        // Find the config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Find the pool PDA
        const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
        spinner.text = `Pool PDA: ${poolPda.toString()}`;

        // Fetch current pool to get its values
        spinner.text = "Fetching current pool configuration...";
        const pool = await sdk.fetchPoolByAddress(poolPda);

        if (!pool) {
          spinner.fail(`Failed to fetch pool with index ${poolIndex}!`);
          return;
        }

        // Fetch the config to get the token mint
        const config = await sdk.fetchConfigByAddress(configPda);
        if (!config) {
          spinner.fail("Failed to fetch config!");
          return;
        }

        // Get token decimals for proper value calculation
        const decimals = (await getMint(connection, config.mint)).decimals;

        // Create pool config args from options or current values
        const poolConfig: {
          lockPeriodDays?: number;
          yieldRate?: BN;
          maxNftsCap?: number;
          maxTokensCap?: BN;
        } = {};

        // Only set values that were provided, otherwise use current pool values
        if (options.lockDays) {
          poolConfig.lockPeriodDays = parseInt(options.lockDays);
        } else {
          poolConfig.lockPeriodDays = pool.lockPeriodDays;
        }

        if (options.yieldRate) {
          poolConfig.yieldRate = new BN(parseInt(options.yieldRate));
        } else {
          poolConfig.yieldRate = pool.yieldRate;
        }

        if (options.maxNfts) {
          poolConfig.maxNftsCap = parseInt(options.maxNfts);
        } else {
          poolConfig.maxNftsCap = pool.maxNftsCap;
        }

        if (options.maxTokens) {
          poolConfig.maxTokensCap = new BN(
            parseInt(options.maxTokens) * 10 ** decimals
          );
        } else {
          poolConfig.maxTokensCap = pool.maxTokensCap;
        }

        // Use the RPC method to directly execute the transaction
        spinner.text = "Sending transaction to update pool configuration...";

        const txid = await sdk.adminSetPoolConfigRpc({
          authority: wallet.publicKey,
          configId,
          poolIndex,
          poolConfigArgs: poolConfig as any,
        });

        spinner.succeed(
          `Pool ${poolIndex} configuration updated successfully. Tx: ${txid}`
        );

        // Fetch and display updated pool status
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const updatedPool = await sdk.fetchPoolByAddress(poolPda);

        if (updatedPool) {
          console.log(`\nUpdated Pool ${poolIndex} Configuration:`);
          console.log(`- Pool PDA: ${poolPda.toString()}`);
          console.log(`- Lock Period: ${updatedPool.lockPeriodDays} days`);
          console.log(
            `- Yield Rate: ${updatedPool.yieldRate.toNumber() / 100}%`
          );
          console.log(`- Max NFTs: ${updatedPool.maxNftsCap}`);
          console.log(`- Max Tokens: ${updatedPool.maxTokensCap.toString()}`);
          console.log(`- Paused: ${updatedPool.isPaused ? "Yes" : "No"}`);
        } else {
          console.log(`\nFailed to fetch updated pool configuration.`);
        }
      } catch (error) {
        ora().fail(`Failed to update pool configuration: ${error}`);
        console.error(error);
      }
    });
}
