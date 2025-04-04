import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK, getWallet } from "../utils/connection";
import { PositionType } from "@bert-staking/sdk";
import ora from "ora";

/**
 * Initialize a staking position
 */
export function initializePositionCommand(program: Command): void {
  program
    .command("init-position")
    .description("Initialize a staking position")
    .option(
      "-a, --authority <pubkey>",
      "Authority public key (if different from wallet)"
    )
    .option("-t, --token-mint <pubkey>", "Token mint address")
    .option(
      "-p, --position-type <type>",
      "Position type (token or nft)",
      "token"
    )
    .option(
      "-n, --nft-mint <pubkey>",
      "NFT mint address (required for NFT positions)"
    )
    .action(async (options) => {
      try {
        const spinner = ora("Initializing staking position...").start();

        const sdk = getSDK();
        const wallet = getWallet();

        // Validate token mint address
        if (!options.tokenMint) {
          spinner.fail("Token mint address is required");
          return;
        }

        // Parse position type
        const positionType =
          options.positionType.toLowerCase() === "nft"
            ? PositionType.NFT
            : PositionType.Token;

        // Validate NFT mint for NFT positions
        if (positionType === PositionType.NFT && !options.nftMint) {
          spinner.fail("NFT mint address is required for NFT positions");
          return;
        }

        // Get authority (default to wallet if not provided)
        const authority = options.authority
          ? new PublicKey(options.authority)
          : wallet.publicKey;

        const result = await sdk.initializePositionRpc({
          authority,
          owner: authority,
          tokenMint: new PublicKey(options.tokenMint),
        });

        spinner.succeed(`Position initialized successfully. Tx: ${result}`);

        // Fetch and display position
        spinner.text = "Fetching position details...";
        spinner.start();

        const position = await sdk.fetchPosition(
          wallet.publicKey,
          new PublicKey(options.tokenMint)
        );

        if (!position) {
          spinner.fail("Failed to fetch position after initialization");
          return;
        }

        spinner.succeed("Position details:");
        console.log(`- Owner: ${position.owner.toString()}`);
        console.log(
          `- Position Type: ${
            position.positionType === PositionType.NFT ? "NFT" : "Token"
          }`
        );
        console.log(
          `- Status: ${position.status === 0 ? "Unclaimed" : "Claimed"}`
        );

        if (position.positionType === PositionType.NFT) {
          console.log(`- NFT Mint: ${position.nftMint.toString()}`);
        }

        console.log(
          `- Unlock Time: ${new Date(
            position.unlockTime.toNumber() * 1000
          ).toLocaleString()}`
        );
      } catch (error) {
        ora().fail(`Failed to initialize position: ${error}`);
      }
    });
}
