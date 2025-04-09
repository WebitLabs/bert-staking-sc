import { Program, web3 } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BertStakingPda } from "../pda";

export type StakeNftParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  owner: web3.PublicKey;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  collection: web3.PublicKey;
  asset: web3.PublicKey;
  updateAuthority: web3.PublicKey;
  payer: web3.PublicKey;
  coreProgram?: web3.PublicKey;
};

/**
 * Create an instruction to stake an NFT using Metaplex Core
 */
export async function stakeNftInstruction({
  program,
  pda,
  owner,
  authority,
  mint,
  collection,
  asset,
  updateAuthority,
  payer,
  coreProgram = new web3.PublicKey("mpLbyGeKdRpHLZvN87ggbNGNWQwkz5JWQJ5hKaKwHcw"),
}: StakeNftParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority);
  const [positionPda] = pda.findPositionPda(owner, collection);

  return program.methods
    .stakeNft()
    .accountsStrict({
      owner,
      config: configPda,
      position: positionPda,
      updateAuthority,
      payer: payer || owner,
      asset,
      collection,
      coreProgram,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}