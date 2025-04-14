import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { COLLECTION, MINT } from "../constants";
import { createNftsVaultAccountInstruction } from "@bert-staking/sdk/src/utils";
import { getMint } from "@solana/spl-token";

/**
 * Initialize the staking program
 */
export function initializeCommand(program: Command): void {
  program
    .command("initialize")
    .description("Initialize the BERT staking program")
    .option("-m, --mint <pubkey>", "Token mint address")
    .option("-c, --collection <pubkey>", "NFT collection address")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option(
      "-cap, --max-cap <amount>",
      "Maximum staking capacity in tokens",
      "1000000000"
    )
    .option("-nv, --nft-value <amount>", "NFT value in tokens", "100000")
    .option("-nl, --nft-limit <number>", "NFT limit per user", "5")
    .option(
      "-p1, --pool1-yield <number>",
      "Yield rate for 1-day pool (basis points, e.g. 300 = 3%)",
      "500"
    )
    .option(
      "-p3, --pool3-yield <number>",
      "Yield rate for 3-day pool (basis points)",
      "800"
    )
    .option(
      "-p7, --pool7-yield <number>",
      "Yield rate for 7-day pool (basis points)",
      "1200"
    )
    .option(
      "-p30, --pool30-yield <number>",
      "Yield rate for 30-day pool (basis points)",
      "1800"
    )
    .option("-mn, --max-nfts <number>", "Maximum NFTs per pool", "1000")
    .option(
      "-mt, --max-tokens <number>",
      "Maximum tokens per pool",
      "1000000000"
    )
    .action(async (options) => {
      try {
        const spinner = ora("Initializing BERT staking program...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse mint and collection addresses
        let mint = options.mint
          ? new PublicKey(options.mint)
          : new PublicKey(MINT);
        let collection = options.collection
          ? new PublicKey(options.collection)
          : new PublicKey(COLLECTION);

        const decimals = (await getMint(connection, mint)).decimals;

        // Parse config ID
        const configId = parseInt(options.configId);
        spinner.text = `Initializing with config ID: ${configId}`;

        // Find the config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Find the NFTs vault PDA
        const [nftsVaultPda] = sdk.pda.findNftsVaultPda(configPda, mint);
        spinner.text = `NFTs Vault PDA: ${nftsVaultPda.toString()}`;

        // Create pool configurations with custom yield rates
        const poolsConfig = [
          {
            lockPeriodDays: 1,
            yieldRate: parseInt(options.pool1Yield),
            maxNfts: parseInt(options.maxNfts),
            maxTokens: parseInt(options.maxTokens) * 10 ** decimals,
          },
          {
            lockPeriodDays: 3,
            yieldRate: parseInt(options.pool3Yield),
            maxNfts: parseInt(options.maxNfts),
            maxTokens: parseInt(options.maxTokens) * 10 ** decimals,
          },
          {
            lockPeriodDays: 7,
            yieldRate: parseInt(options.pool7Yield),
            maxNfts: parseInt(options.maxNfts),
            maxTokens: parseInt(options.maxTokens) * 10 ** decimals,
          },
          {
            lockPeriodDays: 30,
            yieldRate: parseInt(options.pool30Yield),
            maxNfts: parseInt(options.maxNfts),
            maxTokens: parseInt(options.maxTokens) * 10 ** decimals,
          },
        ];

        // Create initialize instruction
        spinner.text = "Creating initialize instruction...";

        const maxCap = parseInt(options.maxCap) * 10 ** decimals;
        const nftValueInTokens = parseInt(options.nftValue) * 10 ** decimals;

        let txId;
        try {
          txId = await sdk.initializeRpc({
            authority: wallet.publicKey,
            mint,
            collection,
            id: configId,
            poolsConfig,
            nftsVault: nftsVaultPda,
            maxCap,
            nftValueInTokens,
            nftsLimitPerUser: parseInt(options.nftLimit),
          });
        } catch (err) {
          spinner.fail(`Program failed to initialize. Tx: ${txId}`);
          return;
        }

        spinner.succeed(`Program initialized successfully. Tx: ${txId}`);

        // Fetch and display config
        spinner.text = "Fetching program config...";
        spinner.start();

        // Short delay to ensure config is available
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const config = await sdk.fetchConfigByAddress(configPda);
        if (!config) {
          spinner.fail("Failed to fetch program config!");
          return;
        }

        spinner.succeed("Program configuration: " + configPda.toBase58());

        console.log(`- Authority: ${config.authority.toString()}`);
        console.log(`- Token Mint: ${config.mint.toString()}`);
        console.log(`- Collection: ${config.collection.toString()}`);
        console.log(`- Vault: ${config.vault.toString()}`);
        console.log(`- NFTs Vault: ${config.nftsVault.toString()}`);
        console.log(`- Max Cap: ${config.maxCap.toString()} tokens`);
        console.log(
          `- NFT Value: ${config.nftValueInTokens.toString()} tokens`
        );
        console.log(`- NFT Limit Per User: ${config.nftsLimitPerUser}`);

        // Display pool configurations
        console.log("\nPool Configurations:");
        config.poolsConfig.forEach((pool, index) => {
          console.log(`- Pool ${index + 1} (${pool.lockPeriodDays} days):`);
          console.log(`  - Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
          console.log(`  - Max NFTs: ${pool.maxNftsCap}`);
          console.log(`  - Max Tokens: ${pool.maxTokensCap.toString()}`);
        });
      } catch (error) {
        ora().fail(`Failed to initialize program: ${error}`);
        console.error(error);
      }
    });
}
