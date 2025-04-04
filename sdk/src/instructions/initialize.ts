import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import { LockPeriod } from "../types";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getLockPeriodFromIdl } from "../utils";

export type InitializeParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  collection: web3.PublicKey;
  vault?: web3.PublicKey;
  authorityVault?: web3.PublicKey;
  lockPeriod: LockPeriod;
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
  collection,
  vault,
  authorityVault,
  lockPeriod,
  yieldRate,
  maxCap,
  nftValueInTokens,
  nftsLimitPerUser,
}: InitializeParams): Promise<web3.TransactionInstruction> {
  // Convert numbers to BN if needed
  const yieldRateBN =
    typeof yieldRate === "number" ? new BN(yieldRate) : yieldRate;
  const maxCapBN = typeof maxCap === "number" ? new BN(maxCap) : maxCap;
  const nftValueInTokensBN =
    typeof nftValueInTokens === "number"
      ? new BN(nftValueInTokens)
      : nftValueInTokens;

  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority);

  const lockPeriodObject = getLockPeriodFromIdl(lockPeriod);
  const vaultTA = vault || getAssociatedTokenAddressSync(mint, configPda, true);
  const authorityVaultTa =
    authorityVault || pda.findAuthorityVaultPda(mint, configPda)[0];

  return program.methods
    .initialize(
      lockPeriodObject,
      yieldRateBN,
      maxCapBN,
      nftValueInTokensBN,
      nftsLimitPerUser
    )
    .accountsStrict({
      authority,
      mint,
      collection,
      vault: vaultTA,
      authorityVault: authorityVaultTa,
      config: configPda,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}
