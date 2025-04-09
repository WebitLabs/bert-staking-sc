import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK, getWallet } from "../utils/connection";
import { LockPeriod } from "@bert-staking/sdk";

import ora from "ora";
import { COLLECTION, MINT } from "../constants";
import { createAssociatedTokenAccount } from "@solana/spl-token";

/**
 * Initialize the staking program
 */
export function initializeCommand(program: Command): void {
  program
    .command("initialize")
    .description("Initialize the BERT staking program")
    .option("-m, --mint <pubkey>", "Token mint address")
    .option("-c, --collection <pubkey>", "NFT collection address")
    .option(
      "-cap, --max-cap <amount>",
      "Maximum staking capacity in tokens",
      "1000000000"
    )
    .option("-nv, --nft-value <amount>", "NFT value in tokens", "100000")
    .option("-nl, --nft-limit <number>", "NFT limit per user", "5")
    .action(async (options) => {
      try {
        const spinner = ora("Initializing BERT staking program...").start();

        const sdk = getSDK();
        const wallet = getWallet();

        let mint = new PublicKey(MINT);
        let collection = new PublicKey(COLLECTION);

        // Validate mint address
        if (!options.mint) {
          // spinner.fail("Token mint address is required");
          mint = new PublicKey(MINT);
        }

        // Validate collection address
        if (!options.collection) {
          // spinner.fail("NFT collection address is required");
          collection = new PublicKey(COLLECTION);
        }

        const configId = 2; // Using 1 instead of 0 to test non-default ID
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);

        // Define lock period yields with increasing rates for longer periods
        const lockPeriodYields = new Map<LockPeriod, number>([
          [LockPeriod.OneDay, 500], // 3% for 1 day
          [LockPeriod.ThreeDays, 800], // 5% for 3 days
          [LockPeriod.SevenDays, 1200],
          [LockPeriod.ThirtyDays, 1800], // 12% for 30 days
        ]);

        // create token vault
        const [vaultTA] = sdk.pda.findAuthorityVaultPda(mint, configPda);

        const result = await sdk.initializeRpc({
          authority: wallet.publicKey,
          mint,
          collection,
          id: configId,
          yieldRate: parseInt(options.yieldRate),
          lockPeriodYields,
          maxCap: parseInt(options.maxCap),
          nftValueInTokens: parseInt(options.nftValue),
          nftsLimitPerUser: parseInt(options.nftLimit),
        });

        spinner.succeed(`Program initialized successfully. Tx: ${result}`);

        // Fetch and display config
        spinner.text = "Fetching program config...";
        spinner.start();

        const config = await sdk.fetchConfigByAddress(configPda);
        if (!config) {
          spinner.fail("Failed to fetch program config!");
          return;
        }

        spinner.succeed("Program configuration: " + configPda.toBase58());

        console.log(`- Authority: ${config.authority.toString()}`);
        console.log(`- Token Mint: ${config.mint.toString()}`);
        console.log(`- Collection: ${config.collection.toString()}`);
        console.log(`- Max Cap: ${config.maxCap.toString()} tokens`);
        console.log(
          `- NFT Value: ${config.nftValueInTokens.toString()} tokens`
        );
        console.log(`- NFT Limit Per User: ${config.nftsLimitPerUser}`);
      } catch (error) {
        ora().fail(`Failed to initialize program: ${error}`);
      }
    });
}
