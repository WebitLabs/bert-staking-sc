import { BN, IdlTypes } from "@coral-xyz/anchor";
import { PositionType } from "./types";
import { BertStakingSc } from "./idl";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

// Core program ID from MPL Core
export const CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

/**
 * Calculate the yield amount for a staked amount
 * @param amount The staked amount
 * @param yieldRate The yield rate in basis points (e.g., 500 = 5%)
 * @returns The yield amount
 */
export function calculateYield(
  amount: number | bigint,
  yieldRate: number | bigint
): bigint {
  const amountBigInt = BigInt(amount);
  const yieldRateBigInt = BigInt(yieldRate);

  // Basis points conversion (10000 = 100%)
  return (amountBigInt * yieldRateBigInt) / BigInt(10000);
}

/**
 * Converts days to seconds
 * @param days Number of days
 * @returns Number of seconds
 */
export function daysToSeconds(days: number): number {
  return days * 24 * 60 * 60;
}

/**
 * Calculates the unlock time based on lock period
 * @param lockDays Number of days for the lock period
 * @param currentTimestamp Current timestamp (optional, defaults to now)
 * @returns The unlock timestamp
 */
export function calculateUnlockTime(
  lockDays: number,
  currentTimestamp = Math.floor(Date.now() / 1000)
): number {
  return currentTimestamp + daysToSeconds(lockDays);
}

type PositionTypeIdlType = IdlTypes<BertStakingSc>["positionType"];
// type PoolsConfigType = IdlTypes<BertStakingSc>["poolConfig"];

/**
 * Configuration parameters for a single pool
 */
export interface PoolConfigParams {
  lockPeriodDays: number;
  yieldRate: number | BN;
  maxNfts: number;
  maxTokens: number | BN;
  isPaused?: boolean;
}

/**
 * Get the standard lock period days
 * @returns Array of standard lock period days (1, 3, 7, 30)
 */
export function getStandardLockPeriodDays(): number[] {
  return [1, 3, 7, 30];
}

export function getPositionTypeIdl(p: PositionType): PositionTypeIdlType {
  if (p == PositionType.Token) {
    return { token: {} };
  } else if (p == PositionType.NFT) {
    return { nft: {} };
  } else {
    throw Error("Invalid position type");
  }
}

/**
 * Creates a transaction instruction to create the NFTs vault account
 * @param payer The account that will pay for the account creation
 * @param nftsVaultPda The NFTs vault PDA
 * @param programId The program ID
 * @returns Transaction instruction to create the NFTs vault account
 */
export function createNftsVaultAccountInstruction(
  payer: PublicKey,
  nftsVaultPda: PublicKey,
  programId: PublicKey
): TransactionInstruction {
  // The system account doesn't need any space as it's just used as a reference/PDA
  return SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: nftsVaultPda,
    lamports: 0, // Doesn't need to be rent exempt as it's an address-only reference
    space: 0, // No space needed for data
    programId, // Program that will own the account
  });
}
