import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MINT } from "../constants";

/**
 * Claim token position command implementation
 */
export function claimTokenCommand(program: Command): void {
  program
    .command("claim-token")
    .description("Claim tokens and yield from a staked position")
    .option("-m, --token-mint <pubkey>", "Token mint address")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option("-pos, --position-id <number>", "Position ID to claim", "0")
    .option("-p, --position <pubkey>", "Position address (if you know it)")
    .action(async (options) => {
      try {
        const spinner = ora("Preparing to claim tokens...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const configId = parseInt(options.configId);
        const positionId = parseInt(options.positionId);
        const tokenMint = options.tokenMint
          ? new PublicKey(options.tokenMint)
          : new PublicKey(MINT);

        // Find config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Get position PDA
        let positionPda;
        if (options.position) {
          positionPda = new PublicKey(options.position);
        } else {
          [positionPda] = sdk.pda.findPositionPda(
            wallet.publicKey,
            tokenMint,
            positionId
          );
        }
        spinner.text = `Position PDA: ${positionPda.toString()}`;

        // Get user token account
        const userTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          wallet.publicKey,
          false
        );

        // Get vault account
        const vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);

        // Fetch position before claiming to get details for display
        let positionBefore;
        try {
          positionBefore = await sdk.fetchPositionByAddress(positionPda);
          
          if (!positionBefore) {
            spinner.fail("Position not found");
            return;
          }
          
          if (positionBefore.status.claimed) {
            spinner.fail("Position has already been claimed");
            return;
          }
          
          // Calculate time until unlock
          const now = Math.floor(Date.now() / 1000);
          const unlockTime = positionBefore.unlockTime.toNumber();
          
          if (unlockTime > now) {
            const timeRemaining = unlockTime - now;
            const days = Math.floor(timeRemaining / (24 * 60 * 60));
            const hours = Math.floor((timeRemaining % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((timeRemaining % (60 * 60)) / 60);
            
            spinner.warn(`Position is still locked. Time remaining: ${days}d ${hours}h ${minutes}m`);
            console.log(`Unlock time: ${new Date(unlockTime * 1000).toLocaleString()}`);
            return;
          }
        } catch (err) {
          spinner.warn(`Could not fetch position before claiming: ${err}`);
          // Continue anyway as it might still work
        }

        // Execute claim transaction
        spinner.text = "Claiming tokens...";
        
        const txid = await sdk.claimTokenPositionRpc({
          authority: wallet.publicKey,
          owner: wallet.publicKey,
          positionPda,
          configId,
          tokenMint,
          tokenAccount: userTokenAccount,
          vault: vaultAta,
          positionId,
        });

        spinner.succeed(`Tokens claimed successfully. Tx: ${txid}`);

        // Show position and balance details after claiming
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get decimals for proper display
        const decimals = await getMint(connection, tokenMint).then(m => m.decimals);

        try {
          const config = await sdk.fetchConfigByAddress(configPda);
          const position = await sdk.fetchPositionByAddress(positionPda);
          
          if (position && positionBefore) {
            console.log("\nClaim Summary:");
            
            const poolIndex = positionBefore.lockPeriodYieldIndex;
            const amount = positionBefore.amount.toNumber();
            
            // Get yield rate from config
            if (config && poolIndex < config.poolsConfig.length) {
              const yieldRate = config.poolsConfig[poolIndex].yieldRate.toNumber();
              const yieldAmount = Math.floor(amount * (yieldRate / 10000));
              const totalClaimed = amount + yieldAmount;
              
              console.log(`- Principal: ${(amount / (10 ** decimals)).toFixed(decimals)} tokens`);
              console.log(`- Yield Rate: ${yieldRate / 100}%`);
              console.log(`- Yield Earned: ${(yieldAmount / (10 ** decimals)).toFixed(decimals)} tokens`);
              console.log(`- Total Claimed: ${(totalClaimed / (10 ** decimals)).toFixed(decimals)} tokens`);
              
              // Show lock period
              const lockPeriodDays = config.poolsConfig[poolIndex].lockPeriodDays;
              console.log(`- Lock Period: ${lockPeriodDays} days`);
              
              // Calculate APY
              const apy = (yieldRate / 100) * (365 / lockPeriodDays);
              console.log(`- Equivalent APY: ${apy.toFixed(2)}%`);
            }
            
            console.log(`\nPosition Status: ${position.status.claimed ? "Claimed" : "Unclaimed"}`);
            console.log(`Claimed at: ${new Date().toLocaleString()}`);
          }
        } catch (err) {
          console.log(`\nFailed to fetch updated position details: ${err}`);
        }
      } catch (error) {
        ora().fail(`Failed to claim tokens: ${error}`);
        console.error(error);
      }
    });
}