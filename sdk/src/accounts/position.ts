import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
// import { Position } from "../types";
import { BertStakingSc } from "../idl";
import { BN } from "@coral-xyz/anchor";
import { PositionIdl } from "../types";

/**
 * Fetch a position account for a given owner and collection
 */
export async function fetchPositionRpc(
  owner: PublicKey,
  mint: PublicKey,
  id: number,
  program: Program<BertStakingSc>
): Promise<PositionIdl | null> {
  try {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        owner.toBuffer(),
        mint.toBuffer(),
        new BN(id).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Fetch the account
    const position = await program.account.positionV2.fetchNullable(
      positionPda
    );

    if (!position) {
      return null;
    }

    return position as PositionIdl;
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
): Promise<PositionIdl | null> {
  try {
    // Fetch the account
    const position = await program.account.positionV2.fetchNullable(
      positionAddress
    );

    if (!position) {
      return null;
    }

    return position as PositionIdl;
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
): Promise<PositionIdl[]> {
  try {
    // This uses Anchor's getProvider().connection and adds the deserializer
    const filter = [
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: owner.toBase58(),
        },
      },
    ];

    const positions = await program.account.positionV2.all(filter);

    return positions.map((item) => item.account);
  } catch (error) {
    console.error("Error fetching positions by owner:", error);
    return [];
  }
}
