import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";

export type InitializeParams = {
  program: Program<BertStakingSc>;
  authority: web3.PublicKey;
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
  authority,
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
  const [configPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config"), authority.toBuffer()],
    program.programId
  );

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
      config: configPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}

