import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BertStakingSDK } from "..";
import { CORE_PROGRAM_ID } from "../utils";

export type ClaimNftPositionParams = {
  program: Program<BertStakingSc>;
  sdk: BertStakingSDK;
  authority: web3.PublicKey;
  owner: web3.PublicKey;
  payer: web3.PublicKey;
  positionPda?: web3.PublicKey;
  asset: web3.PublicKey;
  tokenMint: web3.PublicKey;
  tokenAccount?: web3.PublicKey;
  collection?: web3.PublicKey;
  updateAuthority: web3.PublicKey;
  vault?: web3.PublicKey;
  authorityVault?: web3.PublicKey;
  configId?: number;
  positionId?: number;
  poolIndex: number; // Index of the pool to use for claiming
};

/**
 * Create an instruction to claim an NFT staking position
 */
export async function claimNftPositionInstruction({
  program,
  sdk,
  authority,
  owner,
  payer,
  positionPda,
  asset,
  tokenMint,
  tokenAccount,
  collection = web3.PublicKey.default,
  updateAuthority,
  vault,
  configId = 0,
  positionId = 0,
  poolIndex,
}: ClaimNftPositionParams): Promise<web3.TransactionInstruction> {
  // Get authority from config using the configId
  const [configPda] = sdk.pda.findConfigPda(authority, configId);
  const [userPda] = sdk.pda.findUserAccountPda(owner, configPda);

  // Calculate position PDA if not provided
  const positionAddress =
    positionPda ||
    sdk.pda.findNftPositionPda(owner, tokenMint, asset, positionId)[0];

  // Find Pool PDA with the pool index
  const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);

  // Find User Pool Stats PDA
  const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(owner, poolPda);

  // Derive user token account if not provided
  const userTokenAccount =
    tokenAccount ||
    getAssociatedTokenAddressSync(
      tokenMint,
      owner,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

  // Derive the program's token vault if not provided
  const vaultTokenAccount =
    vault ||
    getAssociatedTokenAddressSync(
      tokenMint,
      configPda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

  // Derive the program's authority vault
  const authorityVaultAccount = sdk.pda.findAuthorityVaultPda(
    configPda,
    tokenMint
  )[0];

  return program.methods
    .claimPositionNft()
    .accountsStrict({
      owner,
      payer,
      config: configPda,
      pool: poolPda,
      userAccount: userPda,
      userPoolStats: userPoolStatsPda,
      position: positionAddress,
      collection,
      updateAuthority,
      asset,
      mint: tokenMint,
      tokenAccount: userTokenAccount,
      vault: vaultTokenAccount,
      authorityVault: authorityVaultAccount,
      coreProgram: CORE_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}
