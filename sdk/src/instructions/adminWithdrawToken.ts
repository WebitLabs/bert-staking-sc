import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync 
} from "@solana/spl-token";

export type AdminWithdrawTokenParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: PublicKey;
  destination: PublicKey;
  configId?: number;
  tokenMint: PublicKey;
  amount: number | BN;
  vault?: PublicKey;
  destinationTokenAccount?: PublicKey;
};

/**
 * Creates an instruction to withdraw tokens from the vault
 */
export async function adminWithdrawTokenInstruction({
  program,
  pda,
  authority,
  destination,
  configId = 0,
  tokenMint,
  amount,
  vault,
  destinationTokenAccount,
}: AdminWithdrawTokenParams): Promise<TransactionInstruction> {
  // Find Config PDA
  const [configPda] = pda.findConfigPda(authority, configId);

  // Determine vault address if not provided
  const vaultAddress = vault || getAssociatedTokenAddressSync(
    tokenMint,
    configPda,
    true
  );

  // Determine destination token account if not provided
  const destinationToken = destinationTokenAccount || getAssociatedTokenAddressSync(
    tokenMint,
    destination,
    true
  );

  // Convert amount to BN if necessary
  const amountBN = typeof amount === "number" ? new BN(amount) : amount;

  return program.methods
    .adminWithdrawTokens(amountBN)
    .accountsStrict({
      authority,
      destination,
      config: configPda,
      vault: vaultAddress,
      destinationTokenAccount: destinationToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}