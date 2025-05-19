import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";

export type InitializePoolParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  configId?: number;
  index: number;
  lockPeriodDays: number;
  yieldRate: number | BN;
  maxNftsCap: number;
  maxTokensCap: number | BN;
  maxValueCap: number | BN;
};

/**
 * Create an instruction to initialize a pool
 */
export async function initializePoolInstruction({
  program,
  pda,
  authority,
  configId = 0,
  index,
  lockPeriodDays,
  yieldRate,
  maxNftsCap,
  maxTokensCap,
  maxValueCap,
}: InitializePoolParams): Promise<web3.TransactionInstruction> {
  // Convert numeric values to BN if needed
  const yieldRateBN =
    typeof yieldRate === "number" ? new BN(yieldRate) : yieldRate;
  const maxTokensCapBN =
    typeof maxTokensCap === "number" ? new BN(maxTokensCap) : maxTokensCap;
  const maxValueCapBN =
    typeof maxValueCap === "number" ? new BN(maxValueCap) : maxValueCap;

  // Find Config PDA with the provided ID
  const [configPda] = pda.findConfigPda(authority, configId);

  // Find Pool PDA
  const [poolPda] = pda.findPoolPda(configPda, index);

  return program.methods
    .initializePool(
      index,
      lockPeriodDays,
      yieldRateBN,
      maxNftsCap,
      maxTokensCapBN,
      maxValueCapBN
    )
    .accountsStrict({
      authority,
      config: configPda,
      pool: poolPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}
