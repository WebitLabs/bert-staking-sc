import { IdlTypes } from "@coral-xyz/anchor";
import { LockPeriod, PositionType } from "./types";
import { BertStakingSc } from "./idl";

/**
 * Calculate the yield amount for a staked amount
 * @param amount The staked amount
 * @param yieldRate The yield rate in basis points (e.g., 500 = 5%)
 * @returns The yield amount
 */
export function calculateYield(
  amount: number | bigint,
  yieldRate: number | bigint,
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
  currentTimestamp = Math.floor(Date.now() / 1000),
): number {
  return currentTimestamp + daysToSeconds(lockDays);
}

type LockPeriodIdlType = IdlTypes<BertStakingSc>["lockPeriod"];
type PositionTypeIdlType = IdlTypes<BertStakingSc>["positionType"];

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
  } else if (PositionType.NFT) {
    return { nft: {} };
  } else {
    throw Error("Invalid lock period");
  }
}
