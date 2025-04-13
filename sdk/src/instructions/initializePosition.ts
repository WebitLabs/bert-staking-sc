//
// !!! DEPRECATED - remove !!!
//
// import { Program, web3, BN } from "@coral-xyz/anchor";
// import { BertStakingSc } from "../idl";
// import { BertStakingPda } from "../pda";
// import { PositionType } from "../types";
// import { getPositionTypeIdl } from "../utils";
//
// import {
//   ASSOCIATED_TOKEN_PROGRAM_ID,
//   TOKEN_PROGRAM_ID,
// } from "@solana/spl-token";
//
// export type InitializePositionParams = {
//   program: Program<BertStakingSc>;
//   pda: BertStakingPda;
//   owner: web3.PublicKey;
//   authority: web3.PublicKey;
//   tokenMint: web3.PublicKey;
//   configId?: number; // ID for the config account
//   positionId?: number; // ID for the position account
//   lockPeriodYieldIndex: number; // Index into the config's lockPeriodYields array
//   positionType: PositionType;
// };
//
// /**
//  * Create an instruction to initialize a staking position
//  */
// export async function initializePositionInstruction({
//   program,
//   pda,
//   owner,
//   authority,
//   tokenMint,
//   configId = 0,
//   positionId = 0,
//   lockPeriodYieldIndex,
//   positionType,
// }: InitializePositionParams): Promise<web3.TransactionInstruction> {
//   // Find Config PDA with the provided ID
//   const [configPda] = pda.findConfigPda(authority, configId);
//
//   // Find Position PDA with the provided ID
//   const [positionPda] = pda.findPositionPda(owner, tokenMint, positionId);
//
//   // Get position type in IDL format
//   const positionTypeObj = getPositionTypeIdl(positionType);
//
//   return program.methods
//     .initiatePosition(new BN(positionId), lockPeriodYieldIndex, positionTypeObj)
//     .accountsStrict({
//       owner,
//       config: configPda,
//       position: positionPda,
//       mint: tokenMint,
//       systemProgram: web3.SystemProgram.programId,
//       tokenProgram: TOKEN_PROGRAM_ID,
//       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//       rent: web3.SYSVAR_RENT_PUBKEY,
//     })
//     .instruction();
// }
