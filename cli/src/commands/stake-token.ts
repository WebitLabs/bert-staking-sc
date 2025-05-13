import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getConnection, getSDK, getWallet } from "../utils/connection";
import ora from "ora";
import { getMint, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MINT } from "../constants";
import { BN } from "@coral-xyz/anchor";

/**
 * Stake tokens command implementation
 */
export function stakeTokenCommand(program: Command): void {
  program
    .command("stake-token")
    .description("Stake tokens with automatic user initialization if needed")
    .option("-m, --token-mint <pubkey>", "Token mint address")
    .option("-a, --amount <number>", "Amount of tokens to stake", "100")
    .option("-p, --pool-index <number>", "Pool index to stake in", "2")
    .option("-id, --config-id <number>", "Config ID", "1")
    .option("-pos, --position-id <number>", "Position ID (optional)", "0")
    .action(async (options) => {
      try {
        const spinner = ora("Staking tokens...").start();

        const sdk = getSDK();
        const wallet = getWallet();
        const connection = getConnection();

        // Parse options
        const configId = parseInt(options.configId);
        const poolIndex = parseInt(options.poolIndex);
        const positionId = parseInt(options.positionId);
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

        // Find Pool PDA
        const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
        spinner.text = `Pool PDA: ${poolPda.toString()}`;

        // Check if user account exists and create it if it doesn't
        const [userAccountPda] = sdk.pda.findUserAccountPda(
          wallet.publicKey,
          configPda
        );
        spinner.text = `User Account PDA: ${userAccountPda.toString()}`;

        try {
          // Try to fetch the user account to see if it exists
          const userAccount = await sdk.fetchUserAccountByAddress(
            userAccountPda
          );
          spinner.text =
            "User account already exists, proceeding with staking...";
        } catch (err) {
          // User account doesn't exist, initialize it
          spinner.text = "User account not found, initializing...";

          try {
            const initUserTxid = await sdk.initializeUserRpc({
              owner: wallet.publicKey,
              authority: wallet.publicKey,
              configId,
              mint: tokenMint,
              poolIndex,
            });

            spinner.text = `User account initialized successfully. Tx: ${initUserTxid}`;
            // Small delay to ensure the account is available
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (initErr) {
            // If initialization fails but it's because the account already exists, continue
            if (
              initErr instanceof Error &&
              !initErr.toString().includes("already in use")
            ) {
              spinner.fail(`Failed to initialize user account: ${initErr}`);
              return;
            }
          }
        }

        // Get user token account
        const userTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          wallet.publicKey,
          false
        );

        // User pool stats PDA will be created during staking if needed
        const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(
          wallet.publicKey,
          poolPda
        );
        spinner.text = `User Pool Stats PDA: ${userPoolStatsPda.toString()}`;

        // Stake the tokens
        spinner.text = `Staking ${options.amount} tokens in pool ${poolIndex}...`;

        const txid = await sdk.stakeTokenRpc({
          authority: wallet.publicKey,
          owner: wallet.publicKey,
          configId,
          positionId,
          tokenMint,
          amount: new BN(amount),
          poolIndex,
          tokenAccount: userTokenAccount,
        });

        spinner.succeed(`Tokens staked successfully. Tx: ${txid}`);

        // Fetch and display position details
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Find the position PDA
        const [positionPda] = sdk.pda.findPositionPda(
          wallet.publicKey,
          tokenMint,
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
          console.log(
            `- Amount: ${(position.amount.toNumber() / 10 ** decimals).toFixed(
              decimals
            )} tokens`
          );
          console.log(`- Position Type: Token`);
          console.log(
            `- Status: ${position.status.unclaimed ? "Unclaimed" : "Claimed"}`
          );
          console.log(`- Pool: ${position.pool.toString()}`);

          // Fetch the pool to show pool details
          const pool = await sdk.fetchPoolByAddress(position.pool);
          if (pool) {
            console.log(`\nPool Details (index ${poolIndex}):`);
            console.log(`- Lock Period: ${pool.lockPeriodDays} days`);
            console.log(`- Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
            console.log(`- Max NFTs: ${pool.maxNftsCap}`);
            console.log(`- Max Tokens: ${pool.maxTokensCap.toString()}`);
            console.log(`- Paused: ${pool.isPaused ? "Yes" : "No"}`);
          }

          console.log(`\nTiming:`);
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
        } catch (err) {
          console.log(`\nFailed to fetch position details: ${err}`);
        }
      } catch (error) {
        ora().fail(`Failed to stake tokens: ${error}`);
        console.error(error);
      }
    });
}
