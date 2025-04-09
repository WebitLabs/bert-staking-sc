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

// IDL types
export type LockPeriodIdl = IdlTypes<BertStakingSc>["lockPeriod"];
export type ConfigIdl = IdlAccounts<BertStakingSc>["config"];
export type PositionIdl = IdlAccounts<BertStakingSc>["position"];
export type LockPeriodYieldIdl = IdlTypes<BertStakingSc>["lockPeriodYield"];

/**
 * Lock period yield mapping structure
 */
export interface LockPeriodYield {
  lockPeriod: LockPeriod;
  yieldRate: BN;
}

/**
 * Config account data structure
 */
export interface Config {
  authority: PublicKey;
  mint: PublicKey;
  collection: PublicKey;
  vault: PublicKey;
  nftsVault: PublicKey;
  authorityVault: PublicKey;
  lockPeriodYields: LockPeriodYield[];
  id: BN;
  maxCap: BN;
  nftValueInTokens: BN;
  nftsLimitPerUser: number;
  totalStakedAmount: BN;
  bump: number;
  authorityVaultBump: number;
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
