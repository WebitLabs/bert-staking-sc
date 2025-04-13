import { BN, IdlTypes } from "@coral-xyz/anchor";
import {
  LockPeriod,
  LockPeriodYield,
  PositionIdl,
  PositionType,
} from "./types";
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

type LockPeriodIdlType = IdlTypes<BertStakingSc>["lockPeriod"];
type PositionTypeIdlType = IdlTypes<BertStakingSc>["positionType"];
type PoolsConfigType = IdlTypes<BertStakingSc>["poolConfig"];

/**
 * Converts a LockPeriod enum value to its IDL representation
 */
export function getLockPeriodFromIdl(p: LockPeriod): LockPeriodIdlType {
  switch (p) {
    case LockPeriod.OneDay:
      return { oneDay: {} };
    case LockPeriod.ThreeDays:
      return { threeDays: {} };
    case LockPeriod.SevenDays:
      return { sevenDays: {} };
    case LockPeriod.ThirtyDays:
      return { thirtyDays: {} };
    default:
      throw new Error(`Invalid lock period: ${p}`);
  }
}

/**
 * Convert an array of lock periods to their IDL representation
 */
export function getLockPeriodsArrayFromIdl(periods: LockPeriod[]) {
  return periods.map((period) => getLockPeriodFromIdl(period));
}

/**
 * Create a PoolConfig IDL object
 */
export function createPoolConfigIdl(
  lockPeriod: LockPeriod,
  yieldRate: number | BN,
  maxNftsCap: number = 1000,
  maxTokensCap: number | BN = 1000000000
): PoolsConfigType {
  const yieldRateBN =
    typeof yieldRate === "number" ? new BN(yieldRate) : yieldRate;
  const maxTokensCapBN =
    typeof maxTokensCap === "number" ? new BN(maxTokensCap) : maxTokensCap;

  return {
    lockPeriod: getLockPeriodFromIdl(lockPeriod),
    yieldRate: yieldRateBN,
    maxNftsCap: maxNftsCap,
    maxTokensCap: maxTokensCapBN,
    padding: [0],
  };
}

/**
 * Create an array of PoolConfig objects for all lock periods
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
  return [
    createPoolConfigIdl(
      LockPeriod.OneDay,
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    ),
    createPoolConfigIdl(
      LockPeriod.ThreeDays,
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    ),
    createPoolConfigIdl(
      LockPeriod.SevenDays,
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap
    ),
    createPoolConfigIdl(
      LockPeriod.ThirtyDays,
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
  yieldRate: number | BN;
  maxNfts: number;
  maxTokens: number | BN;
}

/**
 * Create a pools configuration array with custom settings for each lock period
 * @param poolsConfig Map of lock periods to pool configuration objects
 * @returns Array of PoolConfig objects required by the program
 */
export function createPoolsConfig(
  poolsConfig: Map<LockPeriod, PoolConfigParams>
): PoolsConfigType[] {
  const allPeriods = getAllLockPeriods();
  return allPeriods.map((period) => {
    // Default values if the period is not specified in the map
    const defaultConfig: PoolConfigParams = {
      yieldRate: 500, // 5%
      maxNfts: 1000,
      maxTokens: 1000000000
    };
    
    // Get the configuration for this period or use default
    const config = poolsConfig.get(period) || defaultConfig;
    
    return createPoolConfigIdl(
      period, 
      config.yieldRate, 
      config.maxNfts, 
      config.maxTokens
    );
  });
}

/**
 * Create a custom array of PoolConfig objects with specific yield rates and caps
 * @param yields Map of lock periods to yield rates
 * @param maxNftsCap Default max NFTs cap for all periods
 * @param maxTokensCap Default max tokens cap for all periods
 * @returns Array of PoolConfig objects
 * @deprecated Use createPoolsConfig instead for more granular control
 */
export function createCustomLockPeriodYields(
  yields: Map<LockPeriod, number | BN>,
  maxNftsCap: number = 1000,
  maxTokensCap: number | BN = 1000000000
): PoolsConfigType[] {
  const allPeriods = getAllLockPeriods();
  return allPeriods.map((period) => {
    const yieldRate = yields.get(period) || 500; // Default to 5% if not specified
    return createPoolConfigIdl(period, yieldRate, maxNftsCap, maxTokensCap);
  });
}

/**
 * Create a default array of all lock periods
 * @returns Array of all available lock periods
 */
export function getAllLockPeriods(): LockPeriod[] {
  return [
    LockPeriod.OneDay,
    LockPeriod.ThreeDays,
    LockPeriod.SevenDays,
    LockPeriod.ThirtyDays,
  ];
}

export function getPositionTypeIdl(p: PositionType): PositionTypeIdlType {
  if (p == PositionType.Token) {
    return { token: {} };
  } else if (p == PositionType.NFT) {
    return { nft: {} };
  } else {
    throw Error("Invalid lock period");
  }
}
