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
  nftMint: web3.PublicKey;
  nftTokenAccount?: web3.PublicKey;
  programNftAccount?: web3.PublicKey;
};

/**
 * Create an instruction to stake an NFT
 *
  // TODO: Not yet implemented
 */
export async function stakeNftInstruction({
  program,
  pda,
  owner,
  authority,
  nftMint,
  nftTokenAccount,
  programNftAccount,
}: StakeNftParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority);
  const [positionPda] = pda.findPositionPda(owner, nftMint);

  // Find Program Authority PDA
  const [programAuthority] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    program.programId
  );

  // Derive the NFT token account if not provided
  const userNftTokenAccount =
    nftTokenAccount ||
    web3.PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

  // Derive the program's NFT token account if not provided
  const programNftAta =
    programNftAccount ||
    web3.PublicKey.findProgramAddressSync(
      [
        programAuthority.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        nftMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];

  return program.methods
    .stakeNft()
    .accountsStrict({
      owner,
      config: configPda,
      position: positionPda,
      nftMint,
      nftTokenAccount: userNftTokenAccount,
      programNftAccount: programNftAta,
      programAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}

