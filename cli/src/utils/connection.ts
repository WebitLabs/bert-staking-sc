import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { BertStakingSDK } from "@bert-staking/sdk";
import fs from "fs";
import os from "os";
import path from "path";
import { Command } from "commander";

const DEVNET_RPC = process.env.ENDPOINT1 || "https://api.devnet.solana.com";

// Default RPC endpoints
const ENDPOINTS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: DEVNET_RPC,
  testnet: "https://api.testnet.solana.com",
  localhost: "http://localhost:8899",
};

// Default program ID
const DEFAULT_PROGRAM_ID = "BcTJUjVtpYZ2mozwHxGZdJRfQbEfCoZyEqwus8W2cajq";

// Global connection object
let connection: Connection;
let wallet: Wallet;
let sdk: BertStakingSDK;

/**
 * Load keypair from file
 */
export function loadKeypair(keypairPath: string): Keypair {
  // Expand ~ in path if it exists
  if (keypairPath.startsWith("~")) {
    keypairPath = path.join(os.homedir(), keypairPath.slice(1));
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

/**
 * Setup Solana connection and Anchor provider
 */
export function setupConnection(command: Command): void {
  const options = command.opts();

  console.log("Setup Connection: options:", options);

  // Get network from options or default to localhost
  const network = options.network || "devnet";
  const url =
    options.url ||
    ENDPOINTS[network as keyof typeof ENDPOINTS] ||
    ENDPOINTS.localhost;

  // Setup connection
  connection = new Connection(url, "confirmed");

  // Load keypair from file
  let keypairPath = path.join(process.cwd(), "../admin.json");

  console.log("keypairPath1: ", fs.existsSync(keypairPath));
  try {
    const keypair = loadKeypair(keypairPath);
    wallet = new Wallet(keypair);

    // Create Anchor provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );

    // Create SDK instance
    const programId = options.programId
      ? new PublicKey(options.programId)
      : new PublicKey(DEFAULT_PROGRAM_ID);

    sdk = BertStakingSDK.fromConnection(connection, wallet, programId);

    console.log(`Connected to ${network} (${url})`);
    console.log(`Using keypair: ${wallet.publicKey.toBase58()}`);
    console.log(`Program ID: ${programId.toBase58()}`);
  } catch (error) {
    console.error(`Error loading keypair from ${keypairPath}:`, error);
    process.exit(1);
  }
}

/**
 * Get the current connection
 */
export function getConnection(): Connection {
  if (!connection) {
    throw new Error("Connection not initialized. Call setupConnection first.");
  }
  return connection;
}

/**
 * Get the current wallet
 */
export function getWallet(): Wallet {
  if (!wallet) {
    throw new Error("Wallet not initialized. Call setupConnection first.");
  }
  return wallet;
}

/**
 * Get the SDK instance
 */
export function getSDK(): BertStakingSDK {
  if (!sdk) {
    throw new Error("SDK not initialized. Call setupConnection first.");
  }
  return sdk;
}
