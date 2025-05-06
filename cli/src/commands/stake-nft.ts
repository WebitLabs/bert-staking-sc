import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";
import { MINT } from "../constants";
import { BN } from "@coral-xyz/anchor";

/**
 * Stake NFT command implementation
 */
export function stakeNftCommand(program: Command): void {
  program
    .command("stake-nft")
    .description("Stake an NFT with automatic user initialization if needed")
    .option("-m, --token-mint <pubkey>", "Token mint address")
    .option("-c, --collection <pubkey>", "Collection address")
    .requiredOption("-a, --asset <pubkey>", "Asset/NFT address to stake")
    .option("-p, --pool-index <number>", "Pool index to stake in (0-3)", "2")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option("-pos, --position-id <number>", "Position ID (optional)", "0")
    .action(async (options) => {
      try {
        const spinner = ora("Staking NFT...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Validate required params
        if (!options.asset) {
          spinner.fail("Asset/NFT address is required");
          return;
        }

        // Parse options
        const configId = parseInt(options.configId);
        const poolIndex = parseInt(options.poolIndex);
        const positionId = parseInt(options.positionId);
        const tokenMint = options.tokenMint
          ? new PublicKey(options.tokenMint)
          : new PublicKey(MINT);
        const asset = new PublicKey(options.asset);

        // Find config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Get the config to get the collection
        const config = await sdk.fetchConfigByAddress(configPda);
        if (!config) {
          spinner.fail("Failed to fetch config");
          return;
        }

        // Use provided collection or default from config
        const collection = options.collection
          ? new PublicKey(options.collection)
          : config.collection;

        // Check if user account exists and create it if it doesn't
        const [userAccountPda] = sdk.pda.findUserAccountPda(wallet.publicKey, configPda);
        spinner.text = `User Account PDA: ${userAccountPda.toString()}`;

        try {
          // Try to fetch the user account to see if it exists
          const userAccount = await sdk.fetchUserAccountByAddress(userAccountPda);
          spinner.text = "User account already exists, proceeding with staking...";
        } catch (err) {
          // User account doesn't exist, initialize it
          spinner.text = "User account not found, initializing...";
          
          try {
            const initUserTxid = await sdk.initializeUserRpc({
              owner: wallet.publicKey,
              authority: wallet.publicKey,
              configId,
              mint: tokenMint,
            });
            
            spinner.text = `User account initialized successfully. Tx: ${initUserTxid}`;
            // Small delay to ensure the account is available
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (initErr) {
            // If initialization fails but it's because the account already exists, continue
            if (!initErr.toString().includes("already in use")) {
              spinner.fail(`Failed to initialize user account: ${initErr}`);
              return;
            }
          }
        }

        // Find the NFTs vault PDA
        const [nftsVaultPda] = sdk.pda.findNftsVaultPda(configPda, tokenMint);
        spinner.text = `NFTs Vault PDA: ${nftsVaultPda.toString()}`;

        // Stake the NFT
        spinner.text = `Staking NFT ${asset.toString()} in pool ${poolIndex}...`;
        
        const txid = await sdk.stakeNftRpc({
          authority: wallet.publicKey,
          owner: wallet.publicKey,
          configId,
          positionId,
          mint: tokenMint,
          collection,
          asset,
          poolIndex,
          nftsVault: nftsVaultPda,
        });

        spinner.succeed(`NFT staked successfully. Tx: ${txid}`);

        // Fetch and display position details
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Find the position PDA
        const [positionPda] = sdk.pda.findNftPositionPda(
          wallet.publicKey,
          tokenMint,
          asset,
          positionId
        );
        
        try {
          const position = await sdk.fetchPositionByAddress(positionPda);
          
          if (!position) {
            console.log("\nCouldn't fetch position details");
            return;
          }
          
          console.log("\nPosition Details:");
          console.log(`- PDA: ${positionPda.toString()}`);
          console.log(`- Owner: ${position.owner.toString()}`);
          console.log(`- Position ID: ${position.id.toString()}`);
          console.log(`- Asset: ${position.asset ? position.asset.toString() : "N/A"}`);
          console.log(`- Position Type: NFT`);
          console.log(`- Status: ${position.status.unclaimed ? "Unclaimed" : "Claimed"}`);
          console.log(`- Pool Index: ${position.lockPeriodYieldIndex}`);
          
          // Get the NFT value from config
          if (config) {
            console.log(`- NFT Value: ${(config.nftValueInTokens.toNumber() / (10 ** await getMint(connection, tokenMint).then(m => m.decimals))).toFixed(2)} tokens`);
          }
          
          // Get config to show pool details
          if (config && position.lockPeriodYieldIndex < config.poolsConfig.length) {
            const pool = config.poolsConfig[position.lockPeriodYieldIndex];
            console.log(`\nPool Details (index ${position.lockPeriodYieldIndex}):`);
            console.log(`- Lock Period: ${pool.lockPeriodDays} days`);
            console.log(`- Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
          }
          
          console.log(`\nTiming:`);
          console.log(`- Deposit Time: ${new Date(position.depositTime.toNumber() * 1000).toLocaleString()}`);
          console.log(`- Unlock Time: ${new Date(position.unlockTime.toNumber() * 1000).toLocaleString()}`);
          
          // Calculate yield amount
          if (config) {
            const yieldRate = config.poolsConfig[position.lockPeriodYieldIndex].yieldRate.toNumber();
            const nftValue = config.nftValueInTokens.toNumber();
            const yieldAmount = nftValue * (yieldRate / 10000);
            const decimals = await getMint(connection, tokenMint).then(m => m.decimals);
            
            console.log(`\nYield Calculation:`);
            console.log(`- NFT Value: ${(nftValue / (10 ** decimals)).toFixed(decimals)} tokens`);
            console.log(`- Yield Rate: ${yieldRate / 100}%`);
            console.log(`- Expected Yield: ${(yieldAmount / (10 ** decimals)).toFixed(decimals)} tokens`);
          }
        } catch (err) {
          console.log(`\nFailed to fetch position details: ${err}`);
        }
      } catch (error) {
        ora().fail(`Failed to stake NFT: ${error}`);
        console.error(error);
      }
    });
}