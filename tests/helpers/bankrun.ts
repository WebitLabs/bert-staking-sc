import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import {
  Keypair,
  TransactionInstruction,
  Transaction,
  PublicKey,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import { BanksClient, BanksTransactionResultWithMeta } from "solana-bankrun";

export async function createAndProcessTransaction(
  client: BanksClient,
  payer: Keypair,
  instruction: TransactionInstruction,
  additionalSigners: Keypair[] = []
): Promise<BanksTransactionResultWithMeta> {
  const tx = new Transaction();

  const [latestBlockhash] = await client.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash;

  tx.add(instruction);
  tx.feePayer = payer.publicKey;
  tx.sign(payer, ...additionalSigners);

  return await client.tryProcessTransaction(tx);
}

export async function getAddedAccountInfo(pubkey: PublicKey) {
  const connection = new Connection(clusterApiUrl("mainnet-beta"));
  const accountInfo = await connection.getAccountInfo(pubkey);
  return { address: pubkey, info: accountInfo };
}
