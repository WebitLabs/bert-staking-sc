import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { UserAccountIdl, UserPoolStatsIdl } from "../types";

/**
 * Extension function to get stats for a specific pool
 * @param userAccount The user account
 * @param poolIndex The pool index to get stats for
 * @returns The stats for the specified pool or null if not found
 */
export function getPoolStats(
  userAccount: UserAccountIdl,
  poolIndex: number
): UserPoolStatsIdl | null {
  if (poolIndex < 0 || poolIndex >= userAccount.poolStats.length) {
    return null;
  }
  return userAccount.poolStats[poolIndex];
}

/**
 * Extension function to get stats for a pool by lock period days
 * @param userAccount The user account
 * @param lockPeriodDays The lock period days to find
 * @returns The stats for the pool with the specified lock period days or null if not found
 */
export function getPoolStatsByLockPeriod(
  userAccount: UserAccountIdl,
  lockPeriodDays: number
): UserPoolStatsIdl | null {
  const poolStats = userAccount.poolStats.find(
    (stats) => stats.lockPeriodDays === lockPeriodDays
  );
  return poolStats || null;
}

/**
 * Extension function to get the total tokens staked across all pools
 * @param userAccount The user account
 * @returns The total tokens staked
 */
export function getTotalTokensStaked(userAccount: UserAccountIdl): BN {
  return userAccount.totalStakedTokenAmount;
}

/**
 * Extension function to get the total NFTs staked across all pools
 * @param userAccount The user account
 * @returns The total NFTs staked
 */
export function getTotalNftsStaked(userAccount: UserAccountIdl): number {
  return userAccount.totalStakedNfts;
}

/**
 * Extension function to get the total claimed yield across all pools
 * @param userAccount The user account
 * @returns The total claimed yield
 */
export function getTotalClaimedYield(userAccount: UserAccountIdl): BN {
  return userAccount.totalClaimedYield;
}

/**
 * Fetch a user account for a given owner and config
 */
export async function fetchUserAccountRpc(
  owner: PublicKey,
  config: PublicKey,
  program: Program<BertStakingSc>
): Promise<UserAccountIdl | null> {
  try {
    const [userPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), owner.toBuffer(), config.toBuffer()],
      program.programId
    );

    // Fetch the account
    const userAccount = await program.account.userAccountV2.fetchNullable(
      userPda
    );

    if (!userAccount) {
      return null;
    }

    return userAccount as UserAccountIdl;
  } catch (error) {
    console.error("Error fetching user account:", error);
    return null;
  }
}

/**
 * Fetch a user account by address
 */
export async function fetchUserAccountByAddressRpc(
  address: PublicKey,
  program: Program<BertStakingSc>
): Promise<UserAccountIdl | null> {
  try {
    // Fetch the account
    const userAccount = await program.account.userAccountV2.fetchNullable(
      address
    );

    if (!userAccount) {
      return null;
    }

    return userAccount as UserAccountIdl;
  } catch (error) {
    console.error("Error fetching user account:", error);
    return null;
  }
}
