import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
// import { Position } from "../types";
import { BertStakingSc } from "../idl";
import { BN } from "@coral-xyz/anchor";
import { PositionIdl, UserAccountIdl } from "../types";

/**
 * Fetch a position account for a given owner and collection
 */
export async function fetchUserAccountRpc(
  owner: PublicKey,
  config: PublicKey,
  program: Program<BertStakingSc>
): Promise<PositionIdl | null> {
  try {
    const [userPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), owner.toBuffer(), config.toBuffer()],
      program.programId
    );

    // Fetch the account
    const position = await program.account.positionV2.fetchNullable(userPda);

    if (!position) {
      return null;
    }

    return position as PositionIdl;
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
