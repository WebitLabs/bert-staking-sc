import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { BertStakingSDK } from '@bert-staking/sdk';
import chalk from 'chalk';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Command } from 'commander';

type NetworkName = 'mainnet' | 'devnet' | 'localhost';

// Known Solana cluster genesis hashes — used to verify the RPC actually
// matches the network the user asked for. If the hash doesn't match, we abort.
const GENESIS_HASHES: Record<Exclude<NetworkName, 'localhost'>, string> = {
  mainnet: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  devnet: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
};

const DEFAULT_PROGRAM_ID = 'BcTJUjVtpYZ2mozwHxGZdJRfQbEfCoZyEqwus8W2cajq';

// CLI dir is two levels above this file in both `src/utils` (ts-node) and
// `dist/utils` (built) layouts, so __dirname-based resolution works for both.
const CLI_ROOT = path.resolve(__dirname, '..', '..');

let connection: Connection;
let wallet: Wallet;
let sdk: BertStakingSDK;

export function loadKeypair(keypairPath: string): Keypair {
  if (keypairPath.startsWith('~')) {
    keypairPath = path.join(os.homedir(), keypairPath.slice(1));
  }
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

function parseNetwork(raw: string | undefined): NetworkName {
  const v = (raw || '').toLowerCase();
  if (v === 'mainnet' || v === 'mainnet-beta') return 'mainnet';
  if (v === 'devnet') return 'devnet';
  if (v === 'localhost' || v === 'local') return 'localhost';
  console.error(
    chalk.red(
      `\nUnknown --network "${raw}". Use one of: mainnet, devnet, localhost.\n`
    )
  );
  process.exit(1);
}

function loadEnvFor(network: NetworkName): void {
  if (network === 'localhost') return;
  const envPath = path.join(CLI_ROOT, `.env.${network}`);
  if (!fs.existsSync(envPath)) {
    console.error(
      chalk.red(`\nMissing env file: ${envPath}\nCreate it with an ENDPOINT=... line.\n`)
    );
    process.exit(1);
  }
  dotenv.config({ path: envPath });
}

function endpointFor(network: NetworkName, override?: string): string {
  if (override) return override;
  if (network === 'localhost') return 'http://localhost:8899';
  if (!process.env.ENDPOINT) {
    console.error(
      chalk.red(`\nENDPOINT not set in .env.${network}.\n`)
    );
    process.exit(1);
  }
  return process.env.ENDPOINT;
}

function printBanner(network: NetworkName, url: string, pubkey: string, programId: string): void {
  const label = network.toUpperCase();
  const bar = '='.repeat(60);
  const tint =
    network === 'mainnet' ? chalk.bgRed.white.bold :
    network === 'devnet' ? chalk.bgGreen.black.bold :
    chalk.bgYellow.black.bold;

  console.log();
  console.log(tint(bar));
  console.log(tint(`   >>>  CONNECTED TO ${label}  <<<`.padEnd(60)));
  console.log(tint(bar));
  console.log(chalk.gray(`  RPC:        ${url}`));
  console.log(chalk.gray(`  Wallet:     ${pubkey}`));
  console.log(chalk.gray(`  Program ID: ${programId}`));
  console.log();
}

export async function setupConnection(command: Command): Promise<void> {
  const options = command.opts();
  const network = parseNetwork(options.network);

  loadEnvFor(network);
  const url = endpointFor(network, options.url);

  connection = new Connection(url, 'confirmed');

  // Verify the RPC actually serves the network the user asked for.
  if (network !== 'localhost') {
    let genesis: string;
    try {
      genesis = await connection.getGenesisHash();
    } catch (err) {
      console.error(chalk.red(`\nFailed to reach RPC ${url}: ${(err as Error).message}\n`));
      process.exit(1);
    }
    const expected = GENESIS_HASHES[network];
    if (genesis !== expected) {
      const actual =
        genesis === GENESIS_HASHES.mainnet ? 'mainnet' :
        genesis === GENESIS_HASHES.devnet ? 'devnet' :
        `unknown (${genesis})`;
      console.error(
        chalk.red.bold(
          `\nNETWORK MISMATCH — you asked for ${network} but the RPC at\n` +
          `  ${url}\n` +
          `is actually serving ${actual}. Aborting.\n` +
          `Fix .env.${network} so ENDPOINT points to a ${network} RPC.\n`
        )
      );
      process.exit(1);
    }
  }

  const keypairPath = path.join(CLI_ROOT, '..', 'admin.json');
  if (!fs.existsSync(keypairPath)) {
    console.error(chalk.red(`\nKeypair not found at ${keypairPath}\n`));
    process.exit(1);
  }

  const keypair = loadKeypair(keypairPath);
  wallet = new Wallet(keypair);

  new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());

  const programId = options.programId
    ? new PublicKey(options.programId)
    : new PublicKey(DEFAULT_PROGRAM_ID);

  sdk = BertStakingSDK.fromConnection(connection, wallet, programId);

  printBanner(network, url, wallet.publicKey.toBase58(), programId.toBase58());
}

export function getConnection(): Connection {
  if (!connection) throw new Error('Connection not initialized. Call setupConnection first.');
  return connection;
}

export function getWallet(): Wallet {
  if (!wallet) throw new Error('Wallet not initialized. Call setupConnection first.');
  return wallet;
}

export function getSDK(): BertStakingSDK {
  if (!sdk) throw new Error('SDK not initialized. Call setupConnection first.');
  return sdk;
}
