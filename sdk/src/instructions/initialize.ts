import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PoolConfigParams } from "../utils";

export type InitializeParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  collection: web3.PublicKey;
  adminWithdrawDestination: web3.PublicKey;
  vault?: web3.PublicKey;
  nftsVault?: web3.PublicKey; // Field for the NFTs vault
  id?: number; // Optional ID for the config
  maxCap: number | BN; // Maximum tokens across all pools
  nftValueInTokens: number | BN;
  nftsLimitPerUser: number;
  // The following are not used directly in initialize anymore but kept for backward compatibility
  poolsConfig?: PoolConfigParams[]; // Array of pool configurations
  defaultYieldRate?: number | BN; // Default yield rate if no poolsConfig provided
  maxNftsCap?: number; // Default maximum NFTs per pool if no poolsConfig provided
  maxTokensCap?: number | BN; // Default maximum tokens per pool if no poolsConfig provided
};

/**
 * Create an instruction to initialize the staking program config
 * 
 * Note: With the new architecture, pools are initialized separately using initializePool
 * after config initialization
 */
export async function initializeInstruction({
  program,
  pda,
  authority,
  mint,
  collection,
  adminWithdrawDestination,
  vault,
  nftsVault,
  id = 0, // Default ID to 0 if not provided
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

  // Get token accounts
  const vaultTA = vault || getAssociatedTokenAddressSync(mint, configPda, true);

  // Create the NFTs vault PDA (if not provided)
  const nftsVaultPDA = nftsVault || pda.findNftsVaultPda(configPda, mint)[0];

  // Initialize with just the basic config values - pools are initialized separately
  return program.methods
    .initialize(
      new BN(id),
      maxCapBN,
      nftValueInTokensBN,
      nftsLimitPerUser
    )
    .accountsStrict({
      authority,
      config: configPda,
      mint,
      collection,
      vault: vaultTA,
      nftsVault: nftsVaultPDA,
      adminWithdrawDestination,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}
