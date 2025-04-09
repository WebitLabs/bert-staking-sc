import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import {
  Keypair,
  TransactionInstruction,
  Transaction,
  PublicKey,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import {
  BanksClient,
  BanksTransactionResultWithMeta,
  Clock,
} from "solana-bankrun";

export async function createAndProcessTransaction(
  client: BanksClient,
  payer: Keypair,
  instructions: TransactionInstruction[],
  additionalSigners: Keypair[] = []
): Promise<BanksTransactionResultWithMeta> {
  const tx = new Transaction();

  const [latestBlockhash] = await client.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash;

  tx.add(...instructions);
  tx.feePayer = payer.publicKey;
  tx.sign(payer, ...additionalSigners);

  return await client.tryProcessTransaction(tx);
}

export async function getAddedAccountInfo(pubkey: PublicKey) {
  const connection = new Connection(clusterApiUrl("mainnet-beta"));
  const accountInfo = await connection.getAccountInfo(pubkey);
  return { address: pubkey, info: accountInfo };
}

export async function advanceUnixTimeStamp(
  provider: BankrunProvider,
  seconds: bigint
) {
  const curClock = await provider.context.banksClient.getClock();
  provider.context.setClock(
    new Clock(
      curClock.slot,
      curClock.epochStartTimestamp,
      curClock.epoch,
      curClock.leaderScheduleEpoch,
      curClock.unixTimestamp + seconds
    )
  );
  await provider.context.banksClient.getClock();
}
