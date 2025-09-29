import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { BertStakingSDK } from "@bert-staking/sdk";
import fs from "fs";
import os from "os";
import path from "path";
import { Command } from "commander";

// Default RPC endpoints
const NETWORK = process.env.NETWORK || "localhost";
const ENDPOINTS = {
  mainnet: process.env.ENDPOINT || "https://api.devnet.solana.com",
  devnet: process.env.ENDPOINT || "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  localhost: "http://localhost:8899"
};

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
  if (!NETWORK) {
    throw new Error(
      "NETWORK environment variable is not set. Please set it to mainnet, devnet, testnet, or localhost."
    );
  }

  // Get network from options or default to localhost
  const url = ENDPOINTS[NETWORK as keyof typeof ENDPOINTS];
  if (!url.includes(NETWORK)) {
    throw new Error(
      `Invalid NETWORK value: ${NETWORK}. The endpoint does not match the network`
    );
  }

  // Default program ID
  const DEFAULT_PROGRAM_ID = process.env.PROGRAM_ID;
  if (!DEFAULT_PROGRAM_ID) {
    throw new Error(
      "PROGRAM_ID environment variable is not set. Please set it to the Bert Staking program ID."
    );
  }
  const options = command.opts();
  console.log("Setup Connection: options:", options);

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
    const programId = new PublicKey(DEFAULT_PROGRAM_ID);

    sdk = BertStakingSDK.fromConnection(connection, wallet, programId);

    console.log(`Connected to ${NETWORK} (${url})`);
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
