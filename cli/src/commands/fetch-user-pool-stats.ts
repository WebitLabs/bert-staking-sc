import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";
import { MINT } from "../constants";

/**
 * Fetch and display user pool stats command
 */
export function fetchUserPoolStatsCommand(program: Command): void {
  program
    .command("fetch-user-pool-stats")
    .description("Fetch and display user pool statistics")
    .option("-u, --user <pubkey>", "User public key (default: current wallet)")
    .requiredOption(
      "-p, --pool-index <number>",
      "Pool index to fetch stats for"
    )
    .option("-id, --config-id <number>", "Config ID", "1")
    .action(async (options) => {
      try {
        const spinner = ora("Fetching user pool statistics...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const poolIndex = parseInt(options.poolIndex);
        const configId = parseInt(options.configId);
        const userPubkey = options.user
          ? new PublicKey(options.user)
          : wallet.publicKey;

        // Find Config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Find Pool PDA
        const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
        spinner.text = `Pool PDA: ${poolPda.toString()}`;

        // Fetch pool to get details
        const pool = await sdk.fetchPoolByAddress(poolPda);
        if (!pool) {
          spinner.fail(`Pool ${poolIndex} not found!`);
          return;
        }

        // Find User Pool Stats PDA
        const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
          userPubkey,
          poolPda
        );
        spinner.text = `User Pool Stats PDA: ${userPoolStatsPda.toString()}`;

        try {
          // Fetch user pool stats
          const userPoolStats = await sdk.fetchUserPoolStatsByAddress(
            userPoolStatsPda
          );

          if (!userPoolStats) {
            spinner.fail(
              `No stats found for user ${userPubkey.toString()} in pool ${poolIndex}`
            );
            console.log(
              "Note: User pool stats are created when staking for the first time."
            );
            return;
          }

          spinner.succeed("User pool statistics found!");

          // Get config for token mint
          const config = await sdk.fetchConfigByAddress(configPda);
          const decimals = config
            ? (await getMint(connection, config.mint)).decimals
            : 9; // Default to 9 decimals if config not found

          console.log(`\nUser Pool Statistics for Pool ${poolIndex}:`);
          console.log(`- User: ${userPoolStats.user.toString()}`);
          console.log(`- Pool: ${userPoolStats.pool.toString()}`);
          console.log(
            `- Tokens Staked: ${(
              parseInt(userPoolStats.tokensStaked.toString()) /
              10 ** decimals
            ).toFixed(decimals)} tokens`
          );
          console.log(`- NFTs Staked: ${userPoolStats.nftsStaked}`);
          console.log(
            `- Total Value: ${(
              parseInt(userPoolStats.totalValue.toString()) /
              10 ** decimals
            ).toFixed(decimals)} tokens`
          );
          console.log(
            `- Claimed Yield: ${(
              parseInt(userPoolStats.claimedYield.toString()) /
              10 ** decimals
            ).toFixed(decimals)} tokens`
          );

          // Display pool info for context
          if (pool) {
            console.log(`\nPool ${poolIndex} Information:`);
            console.log(`- Lock Period: ${pool.lockPeriodDays} days`);
            console.log(`- Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
            console.log(`- Status: ${pool.isPaused ? "Paused" : "Active"}`);
            console.log(
              `- Max NFTs: ${pool.maxNftsCap} (${userPoolStats.nftsStaked}/${pool.maxNftsCap} used)`
            );
            console.log(
              `- Max Tokens: ${(
                pool.maxTokensCap.toNumber() /
                10 ** decimals
              ).toFixed(decimals)} tokens` +
                ` (${(
                  parseInt(userPoolStats.tokensStaked.toString()) /
                  10 ** decimals
                ).toFixed(decimals)}/${(
                  pool.maxTokensCap.toNumber() /
                  10 ** decimals
                ).toFixed(decimals)} used)`
            );
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.toString().includes("Account does not exist")
          ) {
            spinner.info(
              `No stats found for user ${userPubkey.toString()} in pool ${poolIndex}`
            );
            console.log(
              "Note: User pool stats are created when staking for the first time."
            );
          } else {
            spinner.fail(`Error fetching user pool stats: ${err}`);
          }
        }
      } catch (error) {
        ora().fail(`Failed to fetch user pool stats: ${error}`);
        console.error(error);
      }
    });
}

