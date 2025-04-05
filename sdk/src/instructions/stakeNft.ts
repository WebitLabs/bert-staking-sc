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
  nftMint: web3.PublicKey;
  nftTokenAccount?: web3.PublicKey;
  nftsVault?: web3.PublicKey;
};

/**
 * Create an instruction to stake an NFT
 */
export async function stakeNftInstruction({
  program,
  pda,
  owner,
  authority,
  mint,
  collection,
  nftMint,
  nftTokenAccount,
  nftsVault,
}: StakeNftParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority);
  const [positionPda] = pda.findPositionPda(owner, nftMint);

  // Derive the NFT token account if not provided
  const userNftTokenAccount =
    nftTokenAccount ||
    web3.PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )[0];

  // Get the NFTs vault address
  const nftsVaultAddress =
    nftsVault ||
    web3.PublicKey.findProgramAddressSync(
      [Buffer.from("nfts_vault"), configPda.toBuffer()],
      program.programId,
    )[0];

  return program.methods
    .stakeNft()
    .accountsStrict({
      owner,
      config: configPda,
      position: positionPda,
      mint,
      collection,
      nftMint,
      nftTokenAccount: userNftTokenAccount,
      nftsVault: nftsVaultAddress, // Updated to nftsVault
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}
