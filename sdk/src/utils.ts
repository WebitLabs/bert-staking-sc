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

