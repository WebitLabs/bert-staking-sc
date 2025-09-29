import { Program } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";

export type ProposeAdminTransferParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: PublicKey;
  newAdmin: PublicKey;
  configId?: number;
};

export type AcceptAdminTransferParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: PublicKey;
  oldAuthority: PublicKey;
  configId?: number;
};

/**
 * Creates an instruction to propose admin transfer
 */
export async function proposeAdminTransferInstruction({
  program,
  pda,
  authority,
  newAdmin,
  configId = 0,
}: ProposeAdminTransferParams): Promise<TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(configId);

  // Find Proposed Admin PDA
  const [proposedAdminPda] = pda.findProposedAdminPda(configPda);

  return program.methods
    .proposeAdmin(newAdmin)
    .accountsStrict({
      authority,
      config: configPda,
      proposedAdmin: proposedAdminPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/**
 * Creates an instruction to accept admin transfer
 */
export async function acceptAdminTransferInstruction({
  program,
  pda,
  authority,
  oldAuthority,
  configId = 0,
}: AcceptAdminTransferParams): Promise<TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(configId);

  // Find Proposed Admin PDA
  const [proposedAdminPda] = pda.findProposedAdminPda(configPda);

  return program.methods
    .acceptAdmin()
    .accountsStrict({
      authority,
      oldAuthority,
      config: configPda,
      proposedAdmin: proposedAdminPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}