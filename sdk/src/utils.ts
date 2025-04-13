import { BN, IdlTypes } from "@coral-xyz/anchor";
import { PositionType } from "./types";
import { BertStakingSc } from "./idl";
import { PublicKey } from "@solana/web3.js";

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
type PoolsConfigType = IdlTypes<BertStakingSc>["poolConfig"];

/**
 * Create a PoolConfig IDL object
 */
export function createPoolConfigIdl(
  lockPeriodDays: number,
  yieldRate: number | BN,
  maxNftsCap: number = 1000,
  maxTokensCap: number | BN = 1000000000
): PoolsConfigType {
  const yieldRateBN =
    typeof yieldRate === "number" ? new BN(yieldRate) : yieldRate;
  const maxTokensCapBN =
    typeof maxTokensCap === "number" ? new BN(maxTokensCap) : maxTokensCap;

  // Create a static array of 64 zeros for padding
  const paddingArray = new Array(64).fill(0);

  return {
    lockPeriodDays,
    yieldRate: yieldRateBN,
    maxNftsCap: maxNftsCap,
    maxTokensCap: maxTokensCapBN,
    padding: paddingArray,
  };
}

/**
 * Create an array of PoolConfig objects for standard lock periods
 * @param defaultYieldRate Default yield rate to use for all periods
 * @param maxNftsCap Default max NFTs cap for all periods
 * @param maxTokensCap Default max tokens cap for all periods
 * @returns Array of PoolConfig objects
 */
export function createDefaultLockPeriodYields(
  defaultYieldRate: number | BN = 500,
  maxNftsCap: number = 1000,
  maxTokensCap: number | BN = 1000000000
): PoolsConfigType[] {
  // Use the standard lock periods (1, 3, 7, 30 days)
  return [
    createPoolConfigIdl(
      1, // 1 day
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    ),
    createPoolConfigIdl(
      3, // 3 days
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    ),
    createPoolConfigIdl(
      7, // 7 days
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    ),
    createPoolConfigIdl(
      30, // 30 days
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    ),
  ];
}

/**
 * Configuration parameters for a single pool
 */
export interface PoolConfigParams {
  lockPeriodDays: number;
  yieldRate: number | BN;
  maxNfts: number;
  maxTokens: number | BN;
}

/**
 * Create a pools configuration array with custom settings for each lock period
 * @param poolsConfig Array of pool configuration objects
 * @returns Array of PoolConfig objects required by the program
 */
export function createPoolsConfig(
  poolsConfig: PoolConfigParams[]
): PoolsConfigType[] {
  if (!poolsConfig || poolsConfig.length === 0) {
    // If no config provided, create default configs for standard periods
    return createDefaultLockPeriodYields();
  }

  // Use the provided configurations
  return poolsConfig.map((config) =>
    createPoolConfigIdl(
      config.lockPeriodDays,
      config.yieldRate,
      config.maxNfts,
      config.maxTokens
    )
  );
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
