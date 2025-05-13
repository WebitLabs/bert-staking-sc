import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";

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
        // config.poolsConfig.forEach((pool, index) => {
        //   const poolStats = config.poolsStats[index];
        //
        //   console.log(`\nPool ${index} (${pool.lockPeriodDays} days):`);
        //   console.log(`- Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
        //   console.log(`- Paused: ${pool.isPaused ? "Yes" : "No"}`);
        //
        //   // Max caps
        //   const maxNfts = pool.maxNftsCap;
        //   const maxTokens = pool.maxTokensCap.toNumber() / 10 ** decimals;
        //   console.log(`- Max NFTs: ${maxNfts}`);
        //   console.log(`- Max Tokens: ${maxTokens.toLocaleString()}`);
        //
        //   // Current stats
        //   const tokensStaked =
        //     poolStats.totalTokensStaked.toNumber() / 10 ** decimals;
        //   const nftsStaked = poolStats.totalNftsStaked;
        //   console.log(
        //     `- Current Tokens Staked: ${tokensStaked.toLocaleString()} (${(
        //       (tokensStaked / maxTokens) *
        //       100
        //     ).toFixed(2)}% of max)`
        //   );
        //   console.log(
        //     `- Current NFTs Staked: ${nftsStaked} (${(
        //       (nftsStaked / maxNfts) *
        //       100
        //     ).toFixed(2)}% of max)`
        //   );
        //
        //   // Lifetime stats
        //   const lifetimeTokens =
        //     poolStats.lifetimeTokensStaked.toNumber() / 10 ** decimals;
        //   const lifetimeNfts = poolStats.lifetimeNftsStaked;
        //   const lifetimeYield =
        //     poolStats.lifetimeClaimedYield.toNumber() / 10 ** decimals;
        //   console.log(
        //     `- Lifetime Tokens Staked: ${lifetimeTokens.toLocaleString()}`
        //   );
        //   console.log(`- Lifetime NFTs Staked: ${lifetimeNfts}`);
        //   console.log(
        //     `- Lifetime Yield Claimed: ${lifetimeYield.toLocaleString()}`
        //   );
        //
        //   // Calculate APY
        //   // const apy =
        //   //   (pool.yieldRate.toNumber() / 100) * (365 / pool.lockPeriodDays);
        //   // console.log(`- Equivalent APY: ${apy.toFixed(2)}%`);
        // });
      } catch (error) {
        ora().fail(`Failed to fetch config: ${error}`);
        console.error(error);
      }
    });
}
