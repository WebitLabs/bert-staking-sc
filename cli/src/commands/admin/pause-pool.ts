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
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Find the pool PDA
        const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
        spinner.text = `Pool PDA: ${poolPda.toString()}`;

        // Fetch current pool state
        const poolBefore = await sdk.fetchPoolByAddress(poolPda);
        if (poolBefore && poolBefore.isPaused) {
          spinner.warn(`Pool ${poolIndex} is already paused!`);
          return;
        }

        // Use the RPC method to directly execute the transaction
        const txid = await sdk.adminPausePoolRpc({
          authority: wallet.publicKey,
          configId,
          poolIndex,
        });

        spinner.succeed(`Pool ${poolIndex} paused successfully. Tx: ${txid}`);

        // Fetch and display updated pool status
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const updatedPool = await sdk.fetchPoolByAddress(poolPda);

        if (updatedPool) {
          console.log(`\nPool ${poolIndex} Status:`);
          console.log(`- Pool PDA: ${poolPda.toString()}`);
          console.log(`- Paused: ${updatedPool.isPaused ? "Yes" : "No"}`);
          console.log(`- Lock Period: ${updatedPool.lockPeriodDays} days`);
          console.log(
            `- Yield Rate: ${updatedPool.yieldRate.toNumber() / 100}%`
          );
          console.log(`- Max NFTs: ${updatedPool.maxNftsCap}`);
          console.log(`- Max Tokens: ${updatedPool.maxTokensCap.toString()}`);
        } else {
          console.log(`\nFailed to fetch updated pool status.`);
        }
      } catch (error) {
        ora().fail(`Failed to pause pool: ${error}`);
        console.error(error);
      }
    });
}
