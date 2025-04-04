/**
 * Position types in the staking program
 */
export enum PositionType {
  NFT = 0,
  Token = 1,
}

/**
 * Position status in the staking program
 */
export enum PositionStatus {
  Unclaimed = 0,
  Claimed = 1,
}

/**
 * Lock period enum for staking
 */
export enum LockPeriod {
  OneDay = 1,
  ThreeDays = 3,
  SevenDays = 7,
  ThirtyDays = 30,
}

// Re-export the SDK types we need
// export { BertStakingSDK } from "../../../sdk/src";

