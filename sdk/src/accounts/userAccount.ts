import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { UserAccountIdl, UserPoolStatsIdl } from "../types";

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
    const userAccount = await program.account.userAccountV3.fetchNullable(
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
    const userAccount = await program.account.userAccountV3.fetchNullable(
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
