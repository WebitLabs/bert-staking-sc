import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../../utils/connection";
import ora from "ora";
import { getMint } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

/**
 * Command to withdraw tokens from the yield vault
 */
export function withdrawTokensCommand(program: Command): void {
  program
    .command("admin:withdraw-tokens")
    .description("Withdraw tokens from the yield vault (admin only)")
    .requiredOption("-a, --amount <number>", "Amount of tokens to withdraw")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option(
      "-d, --destination <pubkey>",
      "Destination wallet (must match admin withdraw destination set during initialization)"
    )
    .action(async (options) => {
      try {
        const spinner = ora("Withdrawing tokens from yield vault...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const configId = parseInt(options.configId);

        // Find the config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);

        // Fetch current config
        spinner.text = "Fetching configuration...";
        const config = await sdk.fetchConfigByAddress(configPda);

        if (!config) {
          spinner.fail("Failed to fetch config!");
          return;
        }

        // Get the admin_withdraw_destination from config
        const adminWithdrawDestination = config.adminWithdrawDestination;

        // If user provided a destination, verify it matches the admin_withdraw_destination
        if (options.destination) {
          const userDestination = new PublicKey(options.destination);
          if (!userDestination.equals(adminWithdrawDestination)) {
            spinner.fail(
              "Provided destination does not match the admin withdraw destination set during initialization!"
            );
            return;
          }
        }

        // Get token decimals for proper value calculation
        const decimals = (await getMint(connection, config.mint)).decimals;

        // Calculate amount with decimals
        const amount = new BN(parseFloat(options.amount) * 10 ** decimals);

        // Use the RPC method to directly execute the transaction
        spinner.text = `Withdrawing ${options.amount} tokens from yield vault...`;

        const txid = await sdk.adminWithdrawTokenRpc({
          authority: wallet.publicKey,
          configId,
          tokenMint: config.mint,
          amount,
        });

        spinner.succeed(
          `Successfully withdrew ${options.amount} tokens from yield vault. Tx: ${txid}`
        );
        console.log(`\nDestination: ${adminWithdrawDestination.toString()}`);
      } catch (error) {
        ora().fail(`Failed to withdraw tokens: ${error}`);
        console.error(error);
      }
    });
}
