import { Program, web3 } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import { LockPeriod, PositionType } from "../types";
import { getLockPeriodFromIdl, getPositionTypeIdl } from "../utils";

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
  lockPeriod: LockPeriod;
  positionType: PositionType;
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
  lockPeriod,
  positionType,
}: InitializePositionParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority);

  // Find Position PDA
  const [positionPda] = pda.findPositionPda(owner, tokenMint);

  // Get lock period in IDL format
  const lockPeriodObj = getLockPeriodFromIdl(lockPeriod);
  const positionTypeObj = getPositionTypeIdl(positionType);

  return program.methods
    .initiatePosition(lockPeriodObj, positionTypeObj)
    .accountsStrict({
      owner,
      config: configPda,
      position: positionPda,
      mint: tokenMint, // Changed to match Rust code
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}
