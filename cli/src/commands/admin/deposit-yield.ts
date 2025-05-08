import { Command } from "commander";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../../utils/connection";
import ora from "ora";
import {
  getMint,
  getAssociatedTokenAddressSync,
  createTransferInstruction,
} from "@solana/spl-token";
import { MINT } from "../../constants";

/**
 * CLI command to deposit yield tokens into the authority vault
 */
export function depositYieldCommand(program: Command): void {
  program
    .command("admin:deposit-yield")
    .description("Deposit yield tokens into the authority vault for rewards")
    .option("-a, --amount <number>", "Amount of tokens to deposit", "1000")
    .option("-m, --token-mint <pubkey>", "Token mint address")
    .option("-id, --config-id <number>", "Config ID", "1")
    .action(async (options) => {
      try {
        const spinner = ora("Preparing to deposit yield tokens...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const configId = parseInt(options.configId);
        const tokenMint = options.tokenMint
          ? new PublicKey(options.tokenMint)
          : new PublicKey(MINT);

        // Get token decimals
        const decimals = (await getMint(connection, tokenMint)).decimals;

        // Convert amount to native tokens with decimals
        const amount = parseFloat(options.amount) * 10 ** decimals;

        // Find config PDA
        const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Fetch the config to verify it exists
        const config = await sdk.fetchConfigByAddress(configPda);
        if (!config) {
          spinner.fail(`Configuration with ID ${configId} not found`);
          return;
        }

        // Get user token account and authority vault
        const userTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          wallet.publicKey,
          false
        );

        // Get the authority vault from config
        const authorityVault = config.authorityVault;
        spinner.text = `Authority Vault: ${authorityVault.toString()}`;

        // Check the user's token balance
        const userTokenBalance = await connection.getTokenAccountBalance(
          userTokenAccount
        );
        const userBalance =
          parseFloat(userTokenBalance.value.amount) / 10 ** decimals;

        if (parseFloat(options.amount) > userBalance) {
          spinner.fail(
            `Insufficient balance. You have ${userBalance.toFixed(
              decimals
            )} tokens, but tried to deposit ${options.amount}`
          );
          return;
        }

        // Create a simple SPL transfer instruction
        const transferInstruction = createTransferInstruction(
          userTokenAccount,
          authorityVault,
          wallet.publicKey,
          BigInt(amount)
        );

        // Create and send transaction
        const transaction = new Transaction().add(transferInstruction);
        spinner.text = `Depositing ${options.amount} tokens into authority vault...`;

        const latestBlockhash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = wallet.publicKey;

        // Sign and send
        const signedTx = await wallet.signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());

        // Wait for confirmation
        await connection.confirmTransaction(txid, "confirmed");

        spinner.succeed(
          `Successfully deposited ${options.amount} tokens into authority vault. Tx: ${txid}`
        );

        // Show current balance
        const vaultBalance = await connection.getTokenAccountBalance(
          authorityVault
        );
        console.log(
          `\nAuthority Vault Balance: ${
            parseFloat(vaultBalance.value.amount) / 10 ** decimals
          } tokens`
        );
      } catch (error) {
        ora().fail(`Failed to deposit yield tokens: ${error}`);
        console.error(error);
      }
    });
}

