import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Position } from "../types";
import { BertStakingSc } from "../idl";

/**
 * Fetch a position account for a given owner and collection
 */
export async function fetchPositionRpc(
  owner: PublicKey,
  collection: PublicKey,
  program: Program<BertStakingSc>
): Promise<Position | null> {
  try {
    // Find Position PDA
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), owner.toBuffer(), collection.toBuffer()],
      program.programId
    );

    // Fetch the account
    const position = await program.account.position.fetchNullable(positionPda);

    if (!position) {
      return null;
    }

    return position as unknown as Position;
  } catch (error) {
    console.error("Error fetching position account:", error);
    return null;
  }
}

/**
 * Fetch a position account by address
 */
export async function fetchPositionByAddressRpc(
  positionAddress: PublicKey,
  program: Program<BertStakingSc>
): Promise<Position | null> {
  try {
    // Fetch the account
    const position = await program.account.position.fetchNullable(
      positionAddress
    );

    if (!position) {
      return null;
    }

    return position as unknown as Position;
  } catch (error) {
    console.error("Error fetching position account:", error);
    return null;
  }
}

/**
 * Fetch all position accounts for a given owner
 */
export async function fetchPositionsByOwnerRpc(
  owner: PublicKey,
  program: Program<BertStakingSc>
): Promise<Position[]> {
  try {
    // This uses Anchor's getProvider().connection and adds the deserializer
    const positions = await program.account.position.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: owner.toBase58(),
        },
      },
    ]);

    return positions.map((item) => item.account as unknown as Position);
  } catch (error) {
    console.error("Error fetching positions by owner:", error);
    return [];
  }
}

