import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { UserPoolStatsIdl } from "../types";

/**
 * Fetch a user pool stats account
 */
export async function fetchUserPoolStatsRpc(
  user: PublicKey,
  pool: PublicKey,
  program: Program<BertStakingSc>
): Promise<UserPoolStatsIdl | null> {
  try {
    // Find the user pool stats PDA
    const [userPoolStatsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_pool_stats"), user.toBuffer(), pool.toBuffer()],
      program.programId
    );

    // Fetch the account
    const userPoolStats = await program.account.userPoolStatsAccount.fetchNullable(
      userPoolStatsPda
    );

    if (!userPoolStats) {
      return null;
    }

    return userPoolStats;
  } catch (error) {
    console.error("Error fetching user pool stats account:", error);
    return null;
  }
}

/**
 * Fetch a user pool stats account by address
 */
export async function fetchUserPoolStatsByAddressRpc(
  address: PublicKey,
  program: Program<BertStakingSc>
): Promise<UserPoolStatsIdl | null> {
  try {
    const userPoolStats = await program.account.userPoolStatsAccount.fetchNullable(
      address
    );

    if (!userPoolStats) {
      return null;
    }

    return userPoolStats;
  } catch (error) {
    console.error("Error fetching user pool stats account:", error);
    return null;
  }
}

/**
 * Fetch all user pool stats accounts for a user
 */
export async function fetchUserPoolStatsByUserRpc(
  user: PublicKey,
  program: Program<BertStakingSc>
): Promise<UserPoolStatsIdl[]> {
  try {
    const filter = [
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: user.toBase58(),
        },
      },
    ];

    const userPoolStats = await program.account.userPoolStatsAccount.all(filter);
    return userPoolStats.map((item) => item.account);
  } catch (error) {
    console.error("Error fetching user pool stats by user:", error);
    return [];
  }
}