import { Program, web3 } from "@coral-xyz/anchor";
import { BertStakingSc } from "../idl";
import { BertStakingPda } from "../pda";

export type InitializeUserParams = {
  program: Program<BertStakingSc>;
  pda: BertStakingPda;
  owner: web3.PublicKey;
  configId?: number;
  authority?: web3.PublicKey;
  mint: web3.PublicKey;
  poolIndex: number;
};

/**
 * Create an instruction to initialize a user account
 */
export async function initializeUserInstruction({
  program,
  pda,
  owner,
  configId = 0,
  authority,
  mint,
  poolIndex,
}: InitializeUserParams): Promise<web3.TransactionInstruction> {
  // If authority is not provided, derive it from the owner
  const authorityKey = authority || owner;

  // Find the config PDA
  const [configPda] = pda.findConfigPda(authorityKey, configId);

  // Find the pool PDA
  const [poolPda] = pda.findPoolPda(configPda, poolIndex);

  // Find the user account PDA
  const [userAccountPda] = pda.findUserAccountPda(owner, configPda);

  return program.methods
    .initiateUser()
    .accountsStrict({
      owner,
      config: configPda,
      pool: poolPda,
      userAccount: userAccountPda,
      mint,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();
}
