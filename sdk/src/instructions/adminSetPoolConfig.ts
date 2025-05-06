import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import { PoolConfigArgs } from "../types";

export type AdminSetPoolConfigParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: PublicKey;
  configId?: number;
  poolIndex: number;
  poolConfigArgs: PoolConfigArgs;
};

/**
 * Creates an instruction to set pool configuration
 */
export async function adminSetPoolConfigInstruction({
  program,
  pda,
  authority,
  configId = 0,
  poolIndex,
  poolConfigArgs,
}: AdminSetPoolConfigParams): Promise<TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority, configId);

  const maxTokensCap =
    typeof poolConfigArgs.maxTokensCap === "number"
      ? new BN(poolConfigArgs.maxTokensCap)
      : poolConfigArgs.maxTokensCap;
  const yieldRate =
    typeof poolConfigArgs.yieldRate === "number"
      ? new BN(poolConfigArgs.yieldRate)
      : poolConfigArgs.yieldRate;

  const configArgs = {
    ...poolConfigArgs,
    maxTokensCap,
    yieldRate,
  };

  return program.methods
    .adminSetPoolConfig(poolIndex, configArgs)
    .accountsStrict({
      authority,
      config: configPda,
    })
    .instruction();
}

/**
 * Creates an instruction to pause a pool
 */
export async function adminPausePoolInstruction({
  program,
  pda,
  authority,
  configId = 0,
  poolIndex,
}: Omit<
  AdminSetPoolConfigParams,
  "poolConfigArgs"
>): Promise<TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority, configId);

  return program.methods
    .adminPausePool(poolIndex)
    .accountsStrict({
      authority,
      config: configPda,
    })
    .instruction();
}

/**
 * Creates an instruction to activate a pool
 */
export async function adminActivatePoolInstruction({
  program,
  pda,
  authority,
  configId = 0,
  poolIndex,
}: Omit<
  AdminSetPoolConfigParams,
  "poolConfigArgs"
>): Promise<TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority, configId);

  return program.methods
    .adminActivatePool(poolIndex)
    .accountsStrict({
      authority,
      config: configPda,
    })
    .instruction();
}
