import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { PoolIdl } from "../types";

/**
 * Fetch a pool account by config and index
 */
export async function fetchPoolRpc(
  config: PublicKey,
  index: number,
  program: Program<BertStakingSc>
): Promise<PoolIdl | null> {
  try {
    // Find the pool PDA
    const [poolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        config.toBuffer(),
        new BN(index).toArrayLike(Buffer, "le", 4),
      ],
      program.programId
    );

    // Fetch the account
    const pool = await program.account.pool.fetchNullable(poolPda);

    if (!pool) {
      return null;
    }

    return pool;
  } catch (error) {
    console.error("Error fetching pool account:", error);
    return null;
  }
}

/**
 * Fetch a pool account by address
 */
export async function fetchPoolByAddressRpc(
  poolAddress: PublicKey,
  program: Program<BertStakingSc>
): Promise<PoolIdl | null> {
  try {
    const pool = await program.account.pool.fetchNullable(poolAddress);

    if (!pool) {
      return null;
    }

    return pool;
  } catch (error) {
    console.error("Error fetching pool account:", error);
    return null;
  }
}

/**
 * Fetch all pools for a config
 */
export async function fetchPoolsByConfigRpc(
  config: PublicKey,
  program: Program<BertStakingSc>
): Promise<PoolIdl[]> {
  try {
    const filter = [
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: config.toBase58(),
        },
      },
    ];

    const pools = await program.account.pool.all(filter);
    return pools.map((pool) => pool.account);
  } catch (error) {
    console.error("Error fetching pools by config:", error);
    return [];
  }
}

