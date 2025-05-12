import { Program, web3, BN } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BertStakingPda } from "../pda";
import { CORE_PROGRAM_ID } from "../utils";

export type StakeNftParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  owner: web3.PublicKey;
  authority: web3.PublicKey;
  mint: web3.PublicKey;
  collection: web3.PublicKey;
  asset: web3.PublicKey;
  poolIndex: number; // Index of the pool config to use (determines lock period and yield)
  configId?: number; // ID for the config account
  positionId?: number; // ID for the position account
  nftsVault?: web3.PublicKey; // Optional NFTs vault owner, will be derived if not provided
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
  poolIndex,
  configId = 0,
  positionId = 0,
  nftsVault,
  coreProgram = CORE_PROGRAM_ID,
}: StakeNftParams): Promise<web3.TransactionInstruction> {
  // Find Config PDA with the provided ID
  const [configPda] = pda.findConfigPda(authority, configId);

  // Find Pool PDA with the pool index
  const [poolPda] = pda.findPoolPda(configPda, poolIndex);
  
  // Find User Account PDA
  const [userAccountPda] = pda.findUserAccountPda(owner, configPda);
  
  // Find User Pool Stats PDA
  const [userPoolStatsPda] = pda.findUserPoolStatsPda(owner, poolPda);

  // Find Position PDA with the asset
  const [positionPda] = pda.findNftPositionPda(owner, mint, asset, positionId);

  // Get NFTs vault if not provided (use the vault PDA from config and mint)
  const nftsVaultPda = nftsVault || pda.findNftsVaultPda(configPda, mint)[0];

  return program.methods
    .stakeNft(new BN(positionId))
    .accountsStrict({
      owner,
      config: configPda,
      pool: poolPda,
      userAccount: userAccountPda,
      userPoolStats: userPoolStatsPda,
      position: positionPda,
      asset,
      nftVaultOwner: nftsVaultPda,
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
