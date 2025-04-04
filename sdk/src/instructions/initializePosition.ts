import { Program, web3 } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export type InitializePositionParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  owner: web3.PublicKey;
  authority: web3.PublicKey;
  tokenMint: web3.PublicKey;
};

/**
 * Create an instruction to initialize a staking position
 */
export async function initializePositionInstruction({
  program,
  pda,
  owner,
  authority,
  tokenMint,
}: InitializePositionParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority);

  // Find Position PDA
  const [positionPda] = pda.findPositionPda(owner, tokenMint);

  return program.methods
    .initiatePosition()
    .accountsStrict({
      owner,
      config: configPda,
      position: positionPda,
      tokenMint,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}

