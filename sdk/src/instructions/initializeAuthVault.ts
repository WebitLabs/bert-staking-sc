import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export type InitializeAuthVaultParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  configId?: number;
  tokenMint: web3.PublicKey;
};

/**
 * Create an instruction to initialize the authority vault for a staking config
 */
export async function initializeAuthVaultInstruction({
  program,
  pda,
  authority,
  configId = 0,
  tokenMint,
}: InitializeAuthVaultParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA with the provided ID
  const [configPda] = pda.findConfigPda(authority, configId);

  // Find the authority vault PDA
  const [authVaultPda] = pda.findAuthorityVaultPda(configPda, tokenMint);

  return program.methods
    .initializeAuthVault()
    .accountsStrict({
      authority,
      config: configPda,
      mint: tokenMint,
      authorityVault: authVaultPda,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}