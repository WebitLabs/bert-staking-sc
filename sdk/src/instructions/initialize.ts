import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import { LockPeriod } from "../types";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getLockPeriodFromIdl, getLockPeriodsArrayFromIdl } from "../utils";

export type InitializeParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  collection: web3.PublicKey;
  vault?: web3.PublicKey;
  nftsVault?: web3.PublicKey;
  authorityVault?: web3.PublicKey;
  lockPeriods?: LockPeriod[];
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
  nftsVault,
  authorityVault,
  lockPeriods,
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

  // Use provided lock periods or default to all periods
  const actualLockPeriods = lockPeriods
    ? getLockPeriodsArrayFromIdl(lockPeriods)
    : getLockPeriodsArrayFromIdl([
        LockPeriod.OneDay,
        LockPeriod.ThreeDays,
        LockPeriod.SevenDays,
        LockPeriod.ThirtyDays,
      ]);

  // Get token accounts
  const vaultTA = vault || getAssociatedTokenAddressSync(mint, configPda, true);
  const nftsVaultTA =
    nftsVault ||
    web3.PublicKey.findProgramAddressSync(
      [Buffer.from("nfts_vault"), configPda.toBuffer()],
      program.programId,
    )[0];
  const authorityVaultTA =
    authorityVault || pda.findAuthorityVaultPda(mint, configPda)[0];

  return program.methods
    .initialize(
      actualLockPeriods,
      yieldRateBN,
      maxCapBN,
      nftValueInTokensBN,
      nftsLimitPerUser,
    )
    .accountsStrict({
      authority,
      mint,
      collection,
      vault: vaultTA,
      nftsVault: nftsVaultTA, // Added NFTs vault
      authorityVault: authorityVaultTA,
      config: configPda,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}
