import { Command } from "commander";
import { getSDK, getWallet } from "../../utils/connection";
import ora from "ora";

/**
 * Command to pause a staking pool
 */
export function pausePoolCommand(program: Command): void {
  program
    .command("admin:pause-pool")
    .description("Pause a staking pool")
    .requiredOption("-i, --pool-index <number>", "Pool index to pause")
    .option("-id, --config-id <number>", "Config ID", "1")
    .action(async (options) => {
      try {
        const spinner = ora("Pausing staking pool...").start();

        const sdk = getSDK();
        const wallet = getWallet();

        // Parse options
        const poolIndex = parseInt(options.poolIndex);
        const configId = parseInt(options.configId);

        // Find the config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);

        // Use the RPC method to directly execute the transaction
        const txid = await sdk.adminPausePoolRpc({
          authority: wallet.publicKey,
          configId,
          poolIndex,
        });

        spinner.succeed(`Pool ${poolIndex} paused successfully. Tx: ${txid}`);

        // Fetch and display updated config status
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const config = await sdk.fetchConfigByAddress(configPda);

        if (config && poolIndex < config.poolsConfig.length) {
          console.log(`\nPool ${poolIndex} Status:`);
          console.log(`- Paused: ${config.poolsConfig[poolIndex].isPaused}`);
          console.log(
            `- Lock Period: ${config.poolsConfig[poolIndex].lockPeriodDays} days`
          );
          console.log(
            `- Yield Rate: ${
              config.poolsConfig[poolIndex].yieldRate.toNumber() / 100
            }%`
          );
        } else {
          console.log(`\nFailed to fetch updated pool status.`);
        }
      } catch (error) {
        ora().fail(`Failed to pause pool: ${error}`);
        console.error(error);
      }
    });
}

