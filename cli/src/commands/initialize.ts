import { Command } from "commander";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { COLLECTION, MINT } from "../constants";
import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import { PoolIdl } from "@bert-staking/sdk";

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
      "-a, --admin-withdraw-destination <pubkey>",
      "Admin withdraw destination wallet"
    )
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

        // Set admin withdraw destination (default to wallet if not provided)
        let adminWithdrawDestination = options.adminWithdrawDestination
          ? new PublicKey(options.adminWithdrawDestination)
          : wallet.publicKey;

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

        // Convert values for on-chain representation
        const maxCap = parseInt(options.maxCap) * 10 ** decimals;
        const nftValueInTokens = parseInt(options.nftValue) * 10 ** decimals;
        const nftsLimitPerUser = parseInt(options.nftLimit);

        // 1. INITIALIZE THE BASIC CONFIG (split into individual steps)
        spinner.text = "Step 1: Creating basic config...";

        let transact = new Transaction();

        // Create and send the initialize instruction for main config only
        try {
          // Create initialize instruction
          const initIx = await sdk.initialize({
            id: configId,
            authority: wallet.publicKey,
            adminWithdrawDestination,
            mint,
            collection,
            nftsVault: nftsVaultPda,
            maxCap,
            nftValueInTokens,
            nftsLimitPerUser,
          });

          transact.add(initIx);

          // spinner.text = `Basic config initialized. Tx: ${tx}`;

          // Short delay to ensure config is available
          // await new Promise((resolve) => setTimeout(resolve, 2000));

          // 2. INITIALIZE THE AUTHORITY VAULT
          // spinner.text = "Step 2: Creating authority vault...";

          const authVaultIx = await sdk.initializeAuthVault({
            authority: wallet.publicKey,
            configId,
            tokenMint: mint,
          });

          transact.add(authVaultIx);

          // spinner.text = `Authority vault initialized. Tx: ${authVaultIx}`;

          // Short delay to ensure vault is available
          // await new Promise((resolve) => setTimeout(resolve, 2000));

          // 3. INITIALIZE EACH POOL SEPARATELY
          // Initialize each pool in a separate transaction
          for (let i = 0; i < poolsConfig.length; i++) {
            const poolConfig = poolsConfig[i];
            spinner.text = `Step ${3 + i}: Creating pool ${i} (${
              poolConfig.lockPeriodDays
            } days)...`;

            const initPoolIx = await sdk.initializePool({
              authority: wallet.publicKey,
              configId,
              index: i,
              lockPeriodDays: poolConfig.lockPeriodDays,
              yieldRate: poolConfig.yieldRate,
              maxNftsCap: poolConfig.maxNfts,
              maxTokensCap: poolConfig.maxTokens,
            });

            transact.add(initPoolIx);

            // spinner.text = `Pool ${i} initialized. Tx: ${initPoolIx}`;

            // Short delay to ensure pool is available
            // await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          const provider = sdk.provider;
          const latestBlockhash =
            await provider.connection.getLatestBlockhash();

          transact.recentBlockhash = latestBlockhash.blockhash;
          transact.feePayer = wallet.publicKey;

          if (provider.sendAndConfirm) {
            await provider.sendAndConfirm(transact);
          }
        } catch (err) {
          console.log("Program failed to initialize. Err:", err);
          spinner.fail(`Program failed to initialize.`);
          return;
        }

        spinner.succeed(`Program initialized successfully`);

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
        console.log(
          `- Authority Vault: ${
            config.authorityVault?.toString() || "Not initialized"
          }`
        );
        console.log(
          `- Admin Withdraw Destination: ${config.adminWithdrawDestination.toString()}`
        );
        console.log(`- NFTs Vault: ${config.nftsVault.toString()}`);
        console.log(`- Max Cap: ${config.maxCap.toString()} tokens`);
        console.log(
          `- NFT Value: ${config.nftValueInTokens.toString()} tokens`
        );
        console.log(`- NFT Limit Per User: ${config.nftsLimitPerUser}`);

        // Fetch and display the pool PDAs and configurations
        spinner.text = "Fetching pool configurations...";
        spinner.start();

        // Short delay to ensure pools are available
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Fetch pools by config
        const pools = await sdk.fetchPoolsByConfig(configPda);

        console.log("\nPool Configurations:");
        pools.forEach((pool: PoolIdl, index: number) => {
          console.log(`- Pool ${index} (${pool.lockPeriodDays} days):`);
          console.log(`  - Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
          console.log(`  - Max NFTs: ${pool.maxNftsCap}`);
          console.log(`  - Max Tokens: ${pool.maxTokensCap.toString()}`);
          console.log(`  - Paused: ${pool.isPaused ? "Yes" : "No"}`);
        });
      } catch (error) {
        ora().fail(`Failed to initialize program: ${error}`);
        console.error(error);
      }
    });
}
