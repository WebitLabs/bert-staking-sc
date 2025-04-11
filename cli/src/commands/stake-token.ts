import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK, getWallet } from "../utils/connection";
import { LockPeriod } from "@bert-staking/sdk";
import ora from "ora";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MINT } from "../constants";

/**
 * Stake tokens
 */
export function stakeTokenCommand(program: Command): void {
  program
    .command("stake-token")
    .description("Stake tokens")
    .option(
      "--authority <pubkey>",
      "Authority public key (if different from wallet)"
    )
    .option("-t, --token-mint <pubkey>", "Token mint address")
    .option("-a, --amount <number>", "Amount of tokens to stake", "100")
    .action(async (options) => {
      try {
        const spinner = ora("Staking tokens...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        let tokenMint = options.tokenMint
          ? new PublicKey(options.tokenMint)
          : new PublicKey(MINT);

        // Get authority (default to wallet if not provided)
        const authority = options.authority
          ? new PublicKey(options.authority)
          : wallet.publicKey;

        const userTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          authority,
          true
        );

        // const result = await sdk.stakeTokenRpc({
        //   authority,
        //   owner: wallet.publicKey,
        //   tokenMint,
        //   amount: parseInt(options.amount),
        //   tokenAccount: userTokenAccount,
        // });

        // spinner.succeed(`Tokens staked successfully. Tx: ${result}`);

        // Fetch and display position
        spinner.text = "Fetching position details...";
        spinner.start();

        // const position = await sdk.fetchPosition(wallet.publicKey, tokenMint);
        //
        // if (!position) {
        //   spinner.fail("Failed to fetch position after staking");
        //   return;
        // }
        //
        // spinner.succeed("Position details after staking:");
        // console.log(`- Owner: ${position.owner.toString()}`);
        // console.log(`- Amount: ${position.amount.toString()} tokens`);
        // console.log(
        //   //@ts-ignore
        //   `- Status: ${!!position.status.unclaimed ? "Unclaimed" : "Claimed"}`
        // );
        // console.log(
        //   `- Deposit Time: ${new Date(
        //     position.depositTime.toNumber() * 1000
        //   ).toLocaleString()}`
        // );
        // console.log(
        //   `- Unlock Time: ${new Date(
        //     position.unlockTime.toNumber() * 1000
        //   ).toLocaleString()}`
        // );
      } catch (error) {
        ora().fail(`Failed to stake tokens: ${error}`);
      }
    });
}
