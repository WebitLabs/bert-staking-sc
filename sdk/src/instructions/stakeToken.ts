import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BertStakingPda } from "../pda";

export type StakeTokenParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: web3.PublicKey;
  owner: web3.PublicKey;
  tokenMint: web3.PublicKey;
  amount: number | BN;
  poolIndex: number; // Index of the pool config to use (determines lock period and yield)
  configId?: number; // ID for the config account
  positionId?: number; // ID for the position account
  tokenAccount?: web3.PublicKey;
  vault?: web3.PublicKey;
};

/**
 * Create an instruction to stake tokens
 */
export async function stakeTokenInstruction({
  program,
  pda,
  authority,
  owner,
  tokenMint,
  amount,
  poolIndex,
  configId = 0,
  positionId = 0,
  tokenAccount,
  vault,
}: StakeTokenParams): Promise<web3.TransactionInstruction> {
  // Convert amount to BN if needed
  const amountBN = typeof amount === "number" ? new BN(amount) : amount;

  // Find Config PDA with the provided ID
  const [configPda] = pda.findConfigPda(authority, configId);

  // Find User Account PDA
  const [userAccountPda] = pda.findUserAccountPda(owner, configPda);

  // Find Position PDA with the positionId
  const [positionPda] = pda.findPositionPda(owner, tokenMint, positionId);

  // Derive the token account if not provided
  const userTokenAccount =
    tokenAccount ||
    getAssociatedTokenAddressSync(
      tokenMint,
      owner,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

  // Get vault address
  const vaultAta =
    vault || getAssociatedTokenAddressSync(tokenMint, configPda, true);

  return program.methods
    .stakeToken(new BN(positionId), poolIndex, amountBN)
    .accountsStrict({
      owner,
      config: configPda,
      userAccount: userAccountPda,
      position: positionPda,
      mint: tokenMint,
      tokenAccount: userTokenAccount,
      vault: vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}
