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
  configId = 0,
  positionId = 0,
  tokenAccount,
  vault,
}: StakeTokenParams): Promise<web3.TransactionInstruction> {
  // Convert amount to BN if needed
  const amountBN = typeof amount === "number" ? new BN(amount) : amount;

  const [configPda] = pda.findConfigPda(authority, configId);
  const [positionPda] = pda.findPositionPda(owner, tokenMint, positionId);

  // Derive the token account if not provided
  const userTokenAccount =
    tokenAccount ||
    web3.PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

  // Get vault address
  const vaultAta =
    vault || getAssociatedTokenAddressSync(tokenMint, configPda, true);

  return program.methods
    .stakeToken(amountBN)
    .accountsStrict({
      owner,
      config: configPda,
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
