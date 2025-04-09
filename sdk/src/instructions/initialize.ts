import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import { LockPeriod } from "../types";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createCustomLockPeriodYields,
  createDefaultLockPeriodYields,
} from "../utils";

export type InitializeParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  collection: web3.PublicKey;
  vault?: web3.PublicKey;
  nftsVault?: web3.PublicKey;
  authorityVault?: web3.PublicKey;
  id?: number; // Optional ID for the config
  lockPeriodYields?: Map<LockPeriod, number | BN>; // Map of lock periods to yield rates
  defaultYieldRate?: number | BN; // Default yield rate for all periods if lockPeriodYields not provided
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
  id = 0, // Default ID to 0 if not provided
  lockPeriodYields,
  defaultYieldRate = 500, // Default to 5% if not specified
  maxCap,
  nftValueInTokens,
  nftsLimitPerUser,
}: InitializeParams): Promise<web3.TransactionInstruction> {
  // Convert numbers to BN if needed
  const maxCapBN = typeof maxCap === "number" ? new BN(maxCap) : maxCap;
  const nftValueInTokensBN =
    typeof nftValueInTokens === "number"
      ? new BN(nftValueInTokens)
      : nftValueInTokens;

  // Find Config PDA with the provided ID
  const [configPda] = pda.findConfigPda(authority, id);

  // Create lock period yields mapping
  const lockPeriodYieldsArray = lockPeriodYields
    ? createCustomLockPeriodYields(lockPeriodYields)
    : createDefaultLockPeriodYields(defaultYieldRate);

  // Get token accounts
  const vaultTA = vault || getAssociatedTokenAddressSync(mint, configPda, true);
  const nftsVaultTA =
    nftsVault ||
    web3.PublicKey.findProgramAddressSync(
      [Buffer.from("nfts_vault"), configPda.toBuffer()],
      program.programId
    )[0];
  const authorityVaultTA =
    authorityVault || pda.findAuthorityVaultPda(mint, configPda)[0];

  return program.methods
    .initialize(
      new BN(id),
      lockPeriodYieldsArray,
      maxCapBN,
      nftValueInTokensBN,
      nftsLimitPerUser
    )
    .accountsStrict({
      authority,
      mint,
      collection,
      vault: vaultTA,
      nftsVault: nftsVaultTA,
      authorityVault: authorityVaultTA,
      config: configPda,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}
