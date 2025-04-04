import { Program, web3 } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export type ClaimPositionParams = {
  program: Program<BertStakingSc>;
  owner: web3.PublicKey;
  positionPda: web3.PublicKey;
  tokenMint: web3.PublicKey;
  tokenAccount?: web3.PublicKey;
  programTokenAccount?: web3.PublicKey;
};

/**
 * Create an instruction to claim a staking position
 */
export async function claimPositionInstruction({
  program,
  owner,
  positionPda,
  tokenMint,
  tokenAccount,
  programTokenAccount,
}: ClaimPositionParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA
  const [configPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  // Find Program Authority PDA
  const [programAuthority] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    program.programId
  );

  // Derive the token account if not provided
  const userTokenAccount =
    tokenAccount ||
    web3.PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

  // Derive the program's token account if not provided
  const programTokenAta =
    programTokenAccount ||
    web3.PublicKey.findProgramAddressSync(
      [
        programAuthority.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

  return program.methods
    .claimPosition()
    .accountsStrict({
      owner,
      config: configPda,
      position: positionPda,
      tokenMint,
      tokenAccount: userTokenAccount,
      programTokenAccount: programTokenAta,
      programAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}

