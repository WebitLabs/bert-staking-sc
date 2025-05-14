import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";
import { fetchPoolsByConfigRpc } from "@bert-staking/sdk";

/**
 * Fetch config command implementation
 */
export function fetchConfigCommand(program: Command): void {
  program
    .command("fetch-config")
    .description("Fetch staking program configuration details")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option(
      "-a, --authority <pubkey>",
      "Authority public key (defaults to wallet)"
    )
    .option("-c, --config <pubkey>", "Config PDA (if you know it)")
    .action(async (options) => {
      try {
        const spinner = ora("Fetching staking configuration...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const configId = parseInt(options.configId);
        const authority = options.authority
          ? new PublicKey(options.authority)
          : wallet.publicKey;

        // Get config PDA
        let configPda;
        if (options.config) {
          configPda = new PublicKey(options.config);
        } else {
          [configPda] = sdk.pda.findConfigPda(authority, configId);
        }
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Fetch config details
        const config = await sdk.fetchConfigByAddress(configPda);

        if (!config) {
          spinner.fail(
            `Configuration not found. Make sure the ID (${configId}) is correct.`
          );
          return;
        }

        // Get token details for display
        const tokenMint = config.mint;
        const decimals = await getMint(connection, tokenMint).then(
          (m) => m.decimals
        );

        spinner.succeed("Staking configuration loaded successfully");

        // Display configuration details
        console.log("\n=== Staking Program Configuration ===");
        console.log(`Config ID: ${config.id.toString()}`);
        console.log(`Authority: ${config.authority.toString()}`);
        console.log(`Token Mint: ${config.mint.toString()}`);
        console.log(`Collection: ${config.collection.toString()}`);
        console.log(`Vault: ${config.vault.toString()}`);
        console.log(`NFTs Vault: ${config.nftsVault.toString()}`);
        console.log(`Authority Vault: ${config.authorityVault?.toString()}`);
        console.log(
          `Admin Authority Dest: ${config.adminWithdrawDestination?.toString()}`
        );

        // Format values with proper decimal places
        const maxCap = config.maxCap.toNumber() / 10 ** decimals;
        const totalStaked =
          config.totalStakedAmount.toNumber() / 10 ** decimals;
        const nftValue = config.nftValueInTokens.toNumber() / 10 ** decimals;

        console.log(`\nGlobal Settings:`);
        console.log(`- Max Cap: ${maxCap.toLocaleString()} tokens`);
        console.log(
          `- Total Staked: ${totalStaked.toLocaleString()} tokens (${(
            (totalStaked / maxCap) *
            100
          ).toFixed(2)}% of max)`
        );
        console.log(`- NFT Value: ${nftValue.toLocaleString()} tokens`);
        console.log(`- NFTs Limit Per User: ${config.nftsLimitPerUser}`);
        console.log(`- Total NFTs Staked: ${config.totalNftsStaked}`);

        // Display pools configuration
        console.log("\n=== Pool Configurations ===");
        const pools = await sdk.fetchPoolsByConfig(configPda);

        if (!pools || pools.length === 0) {
          console.log("No pools found for this configuration.");
        } else {
          for (let i = 0; i < pools.length; i++) {
            const pool = pools[i];

            console.log(`\nPool ${i} (${pool.lockPeriodDays} days):`);
            // console.log(`- PDA: ${pool..toString() || "N/A"}`);
            console.log(`- Config: ${pool.config.toString()}`);
            console.log(`- Index: ${pool.index}`);
            console.log(`- Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
            console.log(`- Paused: ${pool.isPaused ? "Yes" : "No"}`);

            // Max caps
            const maxNfts = pool.maxNftsCap;
            const maxTokens = pool.maxTokensCap.toNumber() / 10 ** decimals;
            console.log(`- Max NFTs: ${maxNfts}`);
            console.log(`- Max Tokens: ${maxTokens.toLocaleString()}`);

            // Current stats
            const tokensStaked =
              pool.totalTokensStaked.toNumber() / 10 ** decimals;
            const nftsStaked = pool.totalNftsStaked;
            console.log(
              `- Current Tokens Staked: ${tokensStaked.toLocaleString()} (${
                maxTokens > 0
                  ? ((tokensStaked / maxTokens) * 100).toFixed(2)
                  : 0
              }% of max)`
            );
            console.log(
              `- Current NFTs Staked: ${nftsStaked} (${
                maxNfts > 0 ? ((nftsStaked / maxNfts) * 100).toFixed(2) : 0
              }% of max)`
            );

            // Lifetime stats
            const lifetimeTokens =
              pool.lifetimeTokensStaked.toNumber() / 10 ** decimals;
            const lifetimeNfts = pool.lifetimeNftsStaked;
            const lifetimeYield =
              pool.lifetimeClaimedYield.toNumber() / 10 ** decimals;
            console.log(
              `- Lifetime Tokens Staked: ${lifetimeTokens.toLocaleString()}`
            );
            console.log(`- Lifetime NFTs Staked: ${lifetimeNfts}`);
            console.log(
              `- Lifetime Yield Claimed: ${lifetimeYield.toLocaleString()}`
            );
          }
        }
      } catch (error) {
        ora().fail(`Failed to fetch config: ${error}`);
        console.error(error);
      }
    });
}
