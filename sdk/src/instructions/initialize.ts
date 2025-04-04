import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";

export type InitializeParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  lockTime: number | BN;
  yieldRate: number | BN;
  maxCap: number | BN;
  nftValueInTokens: number | BN;
  nftsLimitPerUser: number;
};

/**
 * Create an instruction to initialize the staking program
 */
export function initializeInstruction({
  program,
  pda,
  authority,
  mint,
  lockTime,
  yieldRate,
  maxCap,
  nftValueInTokens,
  nftsLimitPerUser,
}: InitializeParams): Promise<web3.TransactionInstruction> {
  // Convert numbers to BN if needed
  const lockTimeBN = typeof lockTime === "number" ? new BN(lockTime) : lockTime;
  const yieldRateBN =
    typeof yieldRate === "number" ? new BN(yieldRate) : yieldRate;
  const maxCapBN = typeof maxCap === "number" ? new BN(maxCap) : maxCap;
  const nftValueInTokensBN =
    typeof nftValueInTokens === "number"
      ? new BN(nftValueInTokens)
      : nftValueInTokens;

  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority);

  return program.methods
    .initialize(
      lockTimeBN,
      yieldRateBN,
      maxCapBN,
      nftValueInTokensBN,
      nftsLimitPerUser
    )
    .accountsStrict({
      authority,
      mint,
      config: configPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}

