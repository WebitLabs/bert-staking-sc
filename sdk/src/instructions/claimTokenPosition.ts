import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BertStakingSDK } from "..";

export type ClaimPositionParams = {
  program: Program<BertStakingSc>;
  sdk: BertStakingSDK;
  authority: web3.PublicKey;
  owner: web3.PublicKey;
  positionPda?: web3.PublicKey;
  tokenMint: web3.PublicKey;
  tokenAccount?: web3.PublicKey;
  collection?: web3.PublicKey;
  vault?: web3.PublicKey;
  authorityVault?: web3.PublicKey;
  configId?: number; // ID for the config account
  positionId?: number; // ID for the position account
};

/**
 * Create an instruction to claim a staking position
 */
export async function claimTokenPositionInstruction({
  program,
  sdk,
  authority,
  owner,
  positionPda,
  tokenMint,
  tokenAccount,
  collection = web3.PublicKey.default,
  vault,
  configId = 0,
  positionId = 0,
}: ClaimPositionParams): Promise<web3.TransactionInstruction> {
  // Get authority from config using the configId
  const [configPda] = sdk.pda.findConfigPda(authority, configId);
  const [userPda] = sdk.pda.findUserAccountPda(owner, configPda);

  // Calculate position PDA if not provided
  const positionAddress =
    positionPda || sdk.pda.findPositionPda(owner, tokenMint, positionId)[0];

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
    .claimPositionToken()
    .accountsStrict({
      owner,
      config: configPda,
      userAccount: userPda,
      position: positionAddress,
      collection,
      mint: tokenMint,
      tokenAccount: userTokenAccount,
      vault: vaultTokenAccount,
      authorityVault: authorityVaultAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}
