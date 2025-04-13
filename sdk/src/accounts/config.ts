import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { ConfigIdl } from "../types";
import { BertStakingSc } from "../idl";

/**
 * Fetch the Config account for a given authority
 */
export async function fetchConfigRpc(
  authority: PublicKey,
  program: Program<BertStakingSc>
): Promise<ConfigIdl | null> {
  try {
    // Find Config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), authority.toBuffer()],
      program.programId
    );

    // Fetch the account
    const config = await program.account.config.fetchNullable(configPda);

    if (!config) {
      return null;
    }

    return config;
  } catch (error) {
    console.error("Error fetching config account:", error);
    return null;
  }
}

/**
 * Fetch the Config account by address
 */
export async function fetchConfigByAddressRpc(
  configAddress: PublicKey,
  program: Program<BertStakingSc>
): Promise<ConfigIdl | null> {
  try {
    // Fetch the account
    const config = await program.account.config.fetchNullable(configAddress);

    if (!config) {
      return null;
    }

    return config;
  } catch (error) {
    console.error("Error fetching config account:", error);
    return null;
  }
}
