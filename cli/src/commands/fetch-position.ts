import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK, getWallet } from "../utils/connection";
import { Position, PositionType } from "@bert-staking/sdk";
import ora from "ora";

/**
 * Fetch staking position(s)
 */
export function fetchPositionCommand(program: Command): void {
  program
    .command("fetch-position")
    .description("Fetch staking position(s)")
    .option("-o, --owner <pubkey>", "Position owner (defaults to wallet)")
    .option("-m, --mint <pubkey>", "Token/NFT mint address")
    .option("-p, --position <pubkey>", "Position PDA address")
    .option("--all", "Fetch all positions for the owner", false)
    .action(async (options) => {
      try {
        const spinner = ora("Fetching position(s)...").start();

        const sdk = getSDK();
        const wallet = getWallet();

        // Get owner (default to wallet if not provided)
        const owner = options.owner
          ? new PublicKey(options.owner)
          : wallet.publicKey;

        if (options.all) {
          // Fetch all positions for the owner
          spinner.text = `Fetching all positions for ${owner.toString()}...`;
          const positions = await sdk.fetchPositionsByOwner(owner);

          if (positions.length === 0) {
            spinner.info("No positions found for this owner");
            return;
          }

          spinner.succeed(
            `Found ${positions.length} position(s) for ${owner.toString()}:`
          );

          positions.forEach((position: Position, index: number) => {
            console.log(`\nPosition #${index + 1}:`);
            console.log(`- Owner: ${position.owner.toString()}`);
            console.log(
              `- Position Type: ${
                position.positionType === PositionType.NFT ? "NFT" : "Token"
              }`
            );
            console.log(`- Amount: ${position.amount.toString()} tokens`);
            console.log(
              `- Status: ${
                //@ts-ignore
                !!position.status.unclaimed ? "Unclaimed" : "Claimed"
              }`
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

            if (position.positionType === PositionType.NFT) {
              console.log(`- NFT Mint: ${position.nftMints.toString()}`);
            }
          });

          return;
        }

        let position;

        if (options.position) {
          // Fetch by position PDA
          spinner.text = `Fetching position by address: ${options.position}...`;
          position = await sdk.fetchPositionByAddress(
            new PublicKey(options.position)
          );
        } else if (options.mint) {
          // Fetch by owner and mint
          spinner.text = `Fetching position for owner ${owner.toString()} and mint ${
            options.mint
          }...`;
          position = await sdk.fetchPosition(
            owner,
            new PublicKey(options.mint)
          );
        } else {
          spinner.fail(
            "Either mint, position address, or --all flag is required"
          );
          return;
        }

        if (!position) {
          spinner.fail("Position not found");
          return;
        }

        spinner.succeed("Position details:");

        console.log(`- Owner: ${position.owner.toString()}`);
        console.log(
          `- Position Type: ${
            position.positionType === PositionType.NFT ? "NFT" : "Token"
          }`
        );
        console.log(`- Amount: ${position.amount.toString()} tokens`);
        console.log(
          //@ts-ignore
          `- Status: ${!!position.status.unclaimed ? "Unclaimed" : "Claimed"}`
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

        if (position.positionType === PositionType.NFT) {
          console.log(`- NFT Mint: ${position.nftMints.toString()}`);
        }
      } catch (error) {
        ora().fail(`Failed to fetch position(s): ${error}`);
      }
    });
}
