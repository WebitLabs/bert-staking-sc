import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { UserAccountIdl } from "../types";

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
    const userAccount = await program.account.userAccount.fetchNullable(
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
    const userAccount = await program.account.userAccount.fetchNullable(
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
