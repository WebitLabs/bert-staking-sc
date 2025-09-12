import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";
import { MINT } from "../constants";
import { PositionIdl } from "@bert-staking/sdk";

/**
 * Fetch position command implementation
 */
export function fetchPositionCommand(program: Command): void {
  program
    .command("fetch-position")
    .description("Fetch staking position(s)")
    .option("-o, --owner <pubkey>", "Position owner (defaults to wallet)")
    .option("-id, --position-id <number>", "Position ID", "0")
    .option("-m, --token-mint <pubkey>", "Token mint address")
    .option("-a, --asset <pubkey>", "NFT asset address (for NFT positions)")
    .option("-p, --position <pubkey>", "Position PDA address (if you know it)")
    .option("--all", "Fetch all positions for the owner", false)
    .action(async (options) => {
      try {
        const spinner = ora("Fetching position(s)...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Get owner (default to wallet if not provided)
        const owner = options.owner
          ? new PublicKey(options.owner)
          : wallet.publicKey;

        // Get token mint
        const tokenMint = options.tokenMint
          ? new PublicKey(options.tokenMint)
          : new PublicKey(MINT);

        // Get decimals for proper value display
        const decimals = await getMint(connection, tokenMint).then(
          (m) => m.decimals
        );

        if (options.all) {
          // Fetch all positions for the owner
          spinner.text = `Fetching all positions for ${owner.toString()}...`;

          const positions = await sdk.fetchPositionsByOwner(owner);

          if (!positions || positions.length === 0) {
            spinner.info("No positions found for this owner");
            return;
          }

          spinner.succeed(
            `Found ${positions.length} position(s) for ${owner.toString()}:`
          );

          positions.forEach((position: PositionIdl, index: number) => {
            const positionAmount = position.amount.toNumber() / 10 ** decimals;

            console.log(`\nPosition #${index + 1}:`);
            console.log(`- Owner: ${position.owner.toString()}`);
            console.log(`- Position ID: ${position.id.toString()}`);
            console.log(
              `- Position Type: ${position.positionType.nft ? "NFT" : "Token"}`
            );
            console.log(`- Amount: ${positionAmount.toLocaleString()} tokens`);
            console.log(
              `- Status: ${position.status.unclaimed ? "Unclaimed" : "Claimed"}`
            );
            console.log(
              `- Deposit Time: ${new Date(
                position.depositTime.toNumber() * 1000
              ).toLocaleString()}`
            );
            console.log(
              `- Unlock Time: ${new Date(
                position.unlockTime.toNumber() * 1000
              ).toLocaleString()}`
            );

            // Calculate time until unlock if not claimed
            if (position.status.unclaimed) {
              const now = Math.floor(Date.now() / 1000);
              const unlockTime = position.unlockTime.toNumber();

              if (unlockTime > now) {
                const timeRemaining = unlockTime - now;
                const days = Math.floor(timeRemaining / (24 * 60 * 60));
                const hours = Math.floor(
                  (timeRemaining % (24 * 60 * 60)) / (60 * 60)
                );
                const minutes = Math.floor((timeRemaining % (60 * 60)) / 60);

                console.log(
                  `- Time until unlock: ${days}d ${hours}h ${minutes}m`
                );
              } else {
                console.log(`- Status: Ready to claim (unlock time passed)`);
              }
            }

            if (position.positionType.nft) {
              console.log(`- NFT Asset: ${position.asset.toString()}`);
            }
          });

          return;
        }

        // Fetch a specific position
        let position;
        const positionId = parseInt(options.positionId);

        if (options.position) {
          // Fetch by position PDA
          spinner.text = `Fetching position by address: ${options.position}...`;
          position = await sdk.fetchPositionByAddress(
            new PublicKey(options.position)
          );
        } else if (options.asset) {
          // Fetch NFT position
          spinner.text = `Fetching NFT position for owner ${owner.toString()}...`;
          const asset = new PublicKey(options.asset);
          position = await sdk.fetchPosition(
            owner,
            positionId,
            tokenMint,
            asset
          );
        } else {
          // Fetch token position
          spinner.text = `Fetching token position for owner ${owner.toString()}...`;
          position = await sdk.fetchPosition(owner, positionId, tokenMint);
        }

        if (!position) {
          spinner.fail("Position not found");
          return;
        }

        // Format amount for display
        const positionAmount = position.amount.toNumber() / 10 ** decimals;

        spinner.succeed("Position details:");

        console.log(`- Owner: ${position.owner.toString()}`);
        console.log(`- Position ID: ${position.id.toString()}`);
        console.log(
          `- Position Type: ${position.positionType.nft ? "NFT" : "Token"}`
        );
        console.log(`- Amount: ${positionAmount.toLocaleString()} tokens`);
        console.log(
          `- Status: ${position.status.unclaimed ? "Unclaimed" : "Claimed"}`
        );

        // Calculate time until unlock if not claimed
        if (position.status.unclaimed) {
          const now = Math.floor(Date.now() / 1000);
          const unlockTime = position.unlockTime.toNumber();

          if (unlockTime > now) {
            const timeRemaining = unlockTime - now;
            const days = Math.floor(timeRemaining / (24 * 60 * 60));
            const hours = Math.floor(
              (timeRemaining % (24 * 60 * 60)) / (60 * 60)
            );
            const minutes = Math.floor((timeRemaining % (60 * 60)) / 60);

            console.log(`- Time until unlock: ${days}d ${hours}h ${minutes}m`);
          } else {
            console.log(`- Status: Ready to claim (unlock time passed)`);
          }
        }

        console.log(
          `- Deposit Time: ${new Date(
            position.depositTime.toNumber() * 1000
          ).toLocaleString()}`
        );
        console.log(
          `- Unlock Time: ${new Date(
            position.unlockTime.toNumber() * 1000
          ).toLocaleString()}`
        );

        if (position.positionType.nft) {
          console.log(`- NFT Asset: ${position.asset.toString()}`);
        }
      } catch (error) {
        ora().fail(`Failed to fetch position(s): ${error}`);
        console.error(error);
      }
    });
}
