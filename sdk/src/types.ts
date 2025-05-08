import { BN, IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { BertStakingSc } from "./idl";
import { PublicKey } from "@solana/web3.js";

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
 * Pool configuration arguments structure
 */
export interface PoolConfigArgs {
  lockPeriodDays: number;
  yieldRate: number;
  maxNftsCap: number;
  maxTokensCap: number | BN;
}

/**
 * Error codes from the program
 */
export enum StakingError {
  PositionLocked = 6000,
  PositionAlreadyClaimed = 6001,
  MaxCapReached = 6002,
  NftLimitReached = 6003,
  InvalidAmount = 6004,
  ArithmeticOverflow = 6005,
  InvalidLockPeriod = 6006,
  InvalidPositionType = 6007,
  InvalidNftMint = 6008,
  AlreadyStaked = 6009,
  UserTokensLimitCapReached = 6010,
  InvalidLockPeriodAndYield = 6011,
  StakingNotInitialized = 6012,
  AssetNotStaked = 6013,
  AttributesNotInitialized = 6014,
  InvalidTimestamp = 6015,
  InvalidAdminAmount = 6016,
  PoolAlreadyPaused = 6017,
  PoolAlreadyActive = 6018,
  InvalidPoolPauseState = 6019,
  InsufficientYieldFunds = 6020,
}

// IDL types
export type ConfigIdl = IdlAccounts<BertStakingSc>["config"];
export type UserAccountIdl = IdlAccounts<BertStakingSc>["userAccountV2"];
export type PositionIdl = IdlAccounts<BertStakingSc>["positionV3"];
export type UserPoolStatsIdl = IdlTypes<BertStakingSc>["userPoolStats"];

/**
 * Lock period yield mapping structure
 */
export interface LockPeriodYield {
  lockPeriodDays: number;
  yieldRate: BN;
}

/**
 * Position account data structure
 */
export interface Position {
  owner: PublicKey;
  depositTime: BN;
  amount: BN;
  positionType: PositionType;
  lockPeriodYieldIndex: number; // Index into the config's lockPeriodYields array
  unlockTime: BN;
  status: PositionStatus;
  nftMints: PublicKey[]; // Array of NFT mints (up to 5)
  nftIndex: number; // Number of NFTs staked
  bump: number;
}
