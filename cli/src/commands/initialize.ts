import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK, getWallet } from "../utils/connection";
import { LockPeriod } from "@bert-staking/sdk";

import ora from "ora";
import { COLLECTION, MINT } from "../constants";

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
      "-l, --lock-period <period>",
      "Lock period (1, 3, 7, or 30 days)",
      "7"
    )
    .option(
      "-y, --yield-rate <bps>",
      "Yield rate in basis points (100 = 1%)",
      "500"
    )
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

        // Parse lock period
        let lockPeriod: LockPeriod;
        switch (options.lockPeriod) {
          case "1":
            lockPeriod = LockPeriod.OneDay;
            break;
          case "3":
            lockPeriod = LockPeriod.ThreeDays;
            break;
          case "7":
            lockPeriod = LockPeriod.SevenDays;
            break;
          case "30":
            lockPeriod = LockPeriod.ThirtyDays;
            break;
          default:
            spinner.fail("Invalid lock period. Must be 1, 3, 7, or 30 days.");
            return;
        }

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

        console.log("[init][options]", options);

        const result = await sdk.initializeRpc({
          authority: wallet.publicKey,
          mint,
          collection,
          yieldRate: parseInt(options.yieldRate),
          maxCap: parseInt(options.maxCap),
          nftValueInTokens: parseInt(options.nftValue),
          nftsLimitPerUser: parseInt(options.nftLimit),
        });

        spinner.succeed(`Program initialized successfully. Tx: ${result}`);

        // Fetch and display config
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey);
        spinner.text = "Fetching program config...";
        spinner.start();

        const config = await sdk.fetchConfigByAddress(configPda);
        if (!config) {
          spinner.fail("Failed to fetch program config!");
          return;
        }

        spinner.succeed("Program configuration:");

        console.log(`- Authority: ${config.authority.toString()}`);
        console.log(`- Token Mint: ${config.mint.toString()}`);
        console.log(`- Collection: ${config.collection.toString()}`);
        console.log(`- Lock Period: ${Object.keys(config.lockPeriod)[0]}`);
        console.log(`- Yield Rate: ${config.yieldRate.toString()} bps`);
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
