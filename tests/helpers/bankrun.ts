import { Keypair, TransactionInstruction, Transaction } from "@solana/web3.js";
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
