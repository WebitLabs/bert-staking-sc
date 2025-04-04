import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK, getWallet } from "../utils/connection";
import { LockPeriod } from "@bert-staking/sdk";
import ora from "ora";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

/**
 * Stake tokens
 */
export function stakeTokenCommand(program: Command): void {
  program
    .command("stake-token")
    .description("Stake tokens")
    .option(
      "-a, --authority <pubkey>",
      "Authority public key (if different from wallet)"
    )
    .option("-t, --token-mint <pubkey>", "Token mint address")
    .option("-a, --amount <number>", "Amount of tokens to stake", "100")
    .option(
      "-l, --lock-period <period>",
      "Lock period (1, 3, 7, or 30 days)",
      "7"
    )
    .action(async (options) => {
      try {
        const spinner = ora("Staking tokens...").start();

        const sdk = getSDK();
        const wallet = getWallet();

        // Validate token mint address
        if (!options.tokenMint) {
          spinner.fail("Token mint address is required");
          return;
        }

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

        // Get authority (default to wallet if not provided)
        const authority = options.authority
          ? new PublicKey(options.authority)
          : wallet.publicKey;

        // Create transaction
        const tokenMint = new PublicKey(options.tokenMint);

        const userTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          authority,
          true
        );

        const result = await sdk.stakeToken({
          authority,
          owner: wallet.publicKey,
          tokenMint,
          period: lockPeriod,
          amount: parseInt(options.amount),
          tokenAccount: userTokenAccount,
        });

        spinner.succeed(`Tokens staked successfully. Tx: ${result}`);

        // Fetch and display position
        spinner.text = "Fetching position details...";
        spinner.start();

        const position = await sdk.fetchPosition(wallet.publicKey, tokenMint);

        if (!position) {
          spinner.fail("Failed to fetch position after staking");
          return;
        }

        spinner.succeed("Position details after staking:");
        console.log(`- Owner: ${position.owner.toString()}`);
        console.log(`- Amount: ${position.amount.toString()} tokens`);
        console.log(
          `- Status: ${position.status === 0 ? "Unclaimed" : "Claimed"}`
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
      } catch (error) {
        ora().fail(`Failed to stake tokens: ${error}`);
      }
    });
}
