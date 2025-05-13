import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MINT } from "../constants";

/**
 * Claim NFT position command implementation
 */
export function claimNftCommand(program: Command): void {
  program
    .command("claim-nft")
    .description("Claim an NFT and yield from a staked position")
    .option("-m, --token-mint <pubkey>", "Token mint address")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option("-pos, --position-id <number>", "Position ID to claim", "0")
    .option("-p, --position <pubkey>", "Position address (if you know it)")
    .option("-a, --asset <pubkey>", "NFT asset address (required)")
    .requiredOption(
      "-c, --collection <pubkey>",
      "Collection address (required)"
    )
    .requiredOption(
      "-u, --update-authority <pubkey>",
      "Update authority for the NFT (required)"
    )
    .action(async (options) => {
      try {
        const spinner = ora("Preparing to claim NFT...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const configId = parseInt(options.configId);
        const positionId = parseInt(options.positionId);
        const tokenMint = options.tokenMint
          ? new PublicKey(options.tokenMint)
          : new PublicKey(MINT);

        if (!options.asset) {
          spinner.fail("NFT asset address is required");
          return;
        }

        const asset = new PublicKey(options.asset);
        const collection = new PublicKey(options.collection);
        const updateAuthority = new PublicKey(options.updateAuthority);

        // Find config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Get position PDA
        let positionPda;
        if (options.position) {
          positionPda = new PublicKey(options.position);
        } else {
          [positionPda] = sdk.pda.findNftPositionPda(
            wallet.publicKey,
            tokenMint,
            asset,
            positionId
          );
        }
        spinner.text = `Position PDA: ${positionPda.toString()}`;

        // Get user token account (for yield)
        const userTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          wallet.publicKey,
          false
        );

        // Fetch position before claiming to get details for display and to get the pool
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

          // Make sure this is an NFT position
          if (!positionBefore.positionType.nft) {
            spinner.fail("This is not an NFT position");
            return;
          }

          // Calculate time until unlock
          const now = Math.floor(Date.now() / 1000);
          const unlockTime = positionBefore.unlockTime.toNumber();

          if (unlockTime > now) {
            const timeRemaining = unlockTime - now;
            const days = Math.floor(timeRemaining / (24 * 60 * 60));
            const hours = Math.floor(
              (timeRemaining % (24 * 60 * 60)) / (60 * 60)
            );
            const minutes = Math.floor((timeRemaining % (60 * 60)) / 60);

            spinner.warn(
              `Position is still locked. Time remaining: ${days}d ${hours}h ${minutes}m`
            );
            console.log(
              `Unlock time: ${new Date(unlockTime * 1000).toLocaleString()}`
            );
            return;
          }

          // Get the pool PDA from the position
          spinner.text = `Pool PDA: ${positionBefore.pool.toString()}`;

          // Find User Pool Stats PDA using the owner and pool from the position
          const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
            wallet.publicKey,
            positionBefore.pool
          );
          spinner.text = `User Pool Stats PDA: ${userPoolStatsPda.toString()}`;
        } catch (err) {
          spinner.warn(`Could not fetch position before claiming: ${err}`);
          // Continue anyway as it might still work
        }

        // Execute claim transaction
        spinner.text = "Claiming NFT...";

        const poolIndex = (await sdk.fetchPoolByAddress(positionBefore?.pool!))
          ?.index;

        const txid = await sdk.claimNftPositionRpc({
          authority: wallet.publicKey,
          owner: wallet.publicKey,
          payer: wallet.publicKey,
          positionId,
          asset,
          tokenMint,
          collection,
          updateAuthority,
          configId,
          poolIndex: poolIndex!,
        });

        spinner.succeed(`NFT claimed successfully. Tx: ${txid}`);

        // Show position and balance details after claiming
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get decimals for proper display
        const decimals = await getMint(connection, tokenMint).then(
          (m) => m.decimals
        );

        try {
          const position = await sdk.fetchPositionByAddress(positionPda);

          if (position && positionBefore) {
            console.log("\nClaim Summary:");

            // Get NFT value and yield rate from the pool
            const config = await sdk.fetchConfigByAddress(configPda);
            const pool = await sdk.fetchPoolByAddress(positionBefore.pool);

            if (config && pool) {
              const nftValueInTokens = config.nftValueInTokens.toNumber();
              const yieldRate = pool.yieldRate.toNumber();
              const yieldAmount = Math.floor(
                nftValueInTokens * (yieldRate / 10000)
              );

              console.log(
                `- NFT Value: ${(nftValueInTokens / 10 ** decimals).toFixed(
                  decimals
                )} tokens`
              );
              console.log(`- Yield Rate: ${yieldRate / 100}%`);
              console.log(
                `- Yield Earned: ${(yieldAmount / 10 ** decimals).toFixed(
                  decimals
                )} tokens`
              );

              // Show lock period
              console.log(`- Lock Period: ${pool.lockPeriodDays} days`);

              // Calculate APY
              const apy = (yieldRate / 100) * (365 / pool.lockPeriodDays);
              console.log(`- Equivalent APY: ${apy.toFixed(2)}%`);
            }

            console.log(
              `\nPosition Status: ${
                position.status.claimed ? "Claimed" : "Unclaimed"
              }`
            );
            console.log(`NFT Asset: ${asset.toString()}`);
            console.log(`Claimed at: ${new Date().toLocaleString()}`);

            // Fetch and show updated user pool stats
            if (positionBefore.pool) {
              try {
                const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
                  wallet.publicKey,
                  positionBefore.pool
                );

                const userPoolStats = await sdk.fetchUserPoolStatsByAddress(
                  userPoolStatsPda
                );

                if (userPoolStats) {
                  console.log(`\nUpdated User Pool Stats:`);
                  console.log(`- PDA: ${userPoolStatsPda.toString()}`);
                  console.log(`- User: ${userPoolStats.user.toString()}`);
                  console.log(`- Pool: ${userPoolStats.pool.toString()}`);
                  console.log(
                    `- Tokens Staked: ${userPoolStats.tokensStaked.toString()}`
                  );
                  console.log(`- NFTs Staked: ${userPoolStats.nftsStaked}`);
                  console.log(
                    `- Total Value: ${userPoolStats.totalValue.toString()}`
                  );
                  console.log(
                    `- Claimed Yield: ${userPoolStats.claimedYield.toString()}`
                  );
                }
              } catch (err) {
                console.log(`Failed to fetch updated user pool stats: ${err}`);
              }
            }
          }
        } catch (err) {
          console.log(`\nFailed to fetch updated position details: ${err}`);
        }
      } catch (error) {
        ora().fail(`Failed to claim NFT: ${error}`);
        console.error(error);
      }
    });
}

