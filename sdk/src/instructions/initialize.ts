import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createDefaultLockPeriodYields,
  createPoolsConfig,
  PoolConfigParams,
} from "../utils";

export type InitializeParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  collection: web3.PublicKey;
  vault?: web3.PublicKey;
  id?: number; // Optional ID for the config
  poolsConfig?: PoolConfigParams[]; // Array of pool configurations
  defaultYieldRate?: number | BN; // Default yield rate if no poolsConfig provided
  maxNftsCap?: number; // Default maximum NFTs per pool if no poolsConfig provided
  maxTokensCap?: number | BN; // Default maximum tokens per pool if no poolsConfig provided
  maxCap: number | BN; // Maximum tokens across all pools
  nftValueInTokens: number | BN;
  nftsLimitPerUser: number;
};

/**
 * Create an instruction to initialize the staking program
 */
export async function initializeInstruction({
  program,
  pda,
  authority,
  mint,
  collection,
  vault,
  id = 0, // Default ID to 0 if not provided
  poolsConfig,
  defaultYieldRate = 500, // Default to 5% if not specified
  maxNftsCap = 1000, // Default max NFTs per pool
  maxTokensCap = 1000000000, // Default max tokens per pool
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

  // Create pool configs array
  let poolsConfigArray;
  if (poolsConfig && poolsConfig.length > 0) {
    poolsConfigArray = createPoolsConfig(poolsConfig);
  } else {
    // TODO: Remove
    poolsConfigArray = createDefaultLockPeriodYields(
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    );
  }

  // Get token accounts
  const vaultTA = vault || getAssociatedTokenAddressSync(mint, configPda, true);

  return program.methods
    .initialize(
      new BN(id),
      poolsConfigArray,
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
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}
