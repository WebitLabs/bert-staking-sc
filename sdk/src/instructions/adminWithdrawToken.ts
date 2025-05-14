import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export type AdminWithdrawTokenParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  authority: PublicKey;
  configPda?: PublicKey;
  configId?: number;
  tokenMint: PublicKey;
  amount: number | BN;
  authorityVault?: PublicKey;
  adminWithdrawTokenAccount?: PublicKey;
};

/**
 * Creates an instruction to withdraw tokens from the vault
 */
export async function adminWithdrawTokenInstruction({
  program,
  pda,
  authority,
  configPda,
  configId = 0,
  tokenMint,
  amount,
  authorityVault,
  adminWithdrawTokenAccount,
}: AdminWithdrawTokenParams): Promise<TransactionInstruction> {
  // Find Config PDA
  // const [configPda] = pda.findConfigPda(authority, configId);

  const configAddress = configPda || pda.findConfigPda(authority, configId)[0];

  // Determine authority vault address if not provided
  const authorityVaultAddress =
    authorityVault || pda.findAuthorityVaultPda(configAddress, tokenMint)[0];

  // Fetch the config account to get the adminWithdrawDestination
  const configAccount = await program.account.config.fetch(configAddress);
  const adminWithdrawDestination = configAccount.adminWithdrawDestination;

  // Determine admin withdraw token account if not provided
  const adminWithdrawToken =
    adminWithdrawTokenAccount ||
    getAssociatedTokenAddressSync(tokenMint, adminWithdrawDestination, true);

  // Convert amount to BN if necessary
  const amountBN = typeof amount === "number" ? new BN(amount) : amount;

  return program.methods
    .adminWithdrawTokens(amountBN)
    .accountsStrict({
      authority,
      config: configAddress,
      authorityVault: authorityVaultAddress,
      adminWithdrawDestination: adminWithdrawToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}
