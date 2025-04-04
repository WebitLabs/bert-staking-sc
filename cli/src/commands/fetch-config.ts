import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK } from "../utils/connection";
import ora from "ora";

/**
 * Fetch staking program config
 */
export function fetchConfigCommand(program: Command): void {
  program
    .command("fetch-config")
    .description("Fetch staking program configuration")
    .option("-a, --authority <pubkey>", "Authority public key")
    .option("-c, --config <pubkey>", "Config PDA (alternative to authority)")
    .action(async (options) => {
      try {
        const spinner = ora("Fetching program configuration...").start();

        const sdk = getSDK();

        let config;

        if (options.config) {
          // Fetch by config PDA
          config = await sdk.fetchConfigByAddress(
            new PublicKey(options.config)
          );
        } else if (options.authority) {
          // Fetch by authority
          config = await sdk.fetchConfig(new PublicKey(options.authority));
        } else {
          spinner.fail("Either authority or config address is required");
          return;
        }

        if (!config) {
          spinner.fail("Configuration not found");
          return;
        }

        spinner.succeed("Program configuration:");

        console.log(`- Authority: ${config.authority.toString()}`);
        console.log(`- Token Mint: ${config.mint.toString()}`);
        console.log(`- Collection: ${config.collection.toString()}`);
        console.log(`- Vault: ${config.vault.toString()}`);
        console.log(`- Authority Vault: ${config.authorityVault.toString()}`);
        console.log(`- Lock Period: ${Object.keys(config.lockPeriod)[0]}`);
        console.log(`- Yield Rate: ${config.yieldRate.toString()} bps`);
        console.log(`- Max Cap: ${config.maxCap.toString()} tokens`);
        console.log(
          `- NFT Value: ${config.nftValueInTokens.toString()} tokens`
        );
        console.log(`- NFT Limit Per User: ${config.nftsLimitPerUser}`);
        console.log(
          `- Total Staked Amount: ${config.totalStakedAmount.toString()} tokens`
        );
        console.log(`- Config Bump: ${config.bump}`);
        console.log(`- Authority Vault Bump: ${config.authorityVaultBump}`);
      } catch (error) {
        ora().fail(`Failed to fetch configuration: ${error}`);
      }
    });
}

