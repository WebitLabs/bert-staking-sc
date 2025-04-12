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
  nftMint?: web3.PublicKey;
  tokenAccount?: web3.PublicKey;
  nftTokenAccount?: web3.PublicKey;
  collection?: web3.PublicKey;
  nftsVault?: web3.PublicKey;
  vault?: web3.PublicKey;
  configId?: number; // ID for the config account
  positionId?: number; // ID for the position account
};

/**
 * Create an instruction to claim a staking position
 */
export async function claimPositionInstruction({
  program,
  sdk,
  authority,
  owner,
  positionPda,
  tokenMint,
  nftMint = web3.PublicKey.default,
  tokenAccount,
  nftTokenAccount,
  collection = web3.PublicKey.default,
  nftsVault,
  vault,
  configId = 0,
  positionId = 0,
}: ClaimPositionParams): Promise<web3.TransactionInstruction> {
  // Get authority from config using the configId
  const [configPda] = sdk.pda.findConfigPda(authority, configId);

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

  // Derive user NFT token account if not provided and nftMint is provided
  // For NFT positions, this is the user's NFT token account
  // For token positions, we use a dummy key since it's not used
  const userNftTokenAccount =
    nftTokenAccount ||
    (nftMint && !nftMint.equals(web3.PublicKey.default)
      ? getAssociatedTokenAddressSync(
          nftMint,
          owner,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      : web3.Keypair.generate().publicKey); // Dummy key if nftMint not provided

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

  // Get config to determine NFTs vault
  let nftsVaultAccount = nftsVault;
  if (!nftsVaultAccount) {
    try {
      const configAccount = await program.account.config.fetch(configPda);
      nftsVaultAccount = configAccount.nftsVault;
    } catch (e) {
      // If we can't fetch, use a default value - the claim will fail if incorrect
      nftsVaultAccount = web3.Keypair.generate().publicKey;
    }
  }

  return program.methods
    .claimPosition()
    .accountsStrict({
      owner,
      config: configPda,
      position: positionAddress,
      collection,
      nftMint,
      mint: tokenMint,
      tokenAccount: userTokenAccount,
      nftTokenAccount: userNftTokenAccount,
      nftsVault: nftsVaultAccount,
      vault: vaultTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}
