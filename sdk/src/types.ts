import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

/**
 * Position types in the staking program
 */
export enum PositionType {
  NFT = 0,
  Token = 1
}

/**
 * Position status in the staking program
 */
export enum PositionStatus {
  Unclaimed = 0,
  Claimed = 1
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
  ArithmeticOverflow = 6005
}

/**
 * Config account data structure
 */
export interface Config {
  authority: PublicKey;
  lockTime: BN;
  yieldRate: BN;
  maxCap: BN;
  nftValueInTokens: BN;
  nftsLimitPerUser: number;
  totalStakedAmount: BN;
  bump: number;
}

/**
 * Position account data structure
 */
export interface Position {
  owner: PublicKey;
  depositTime: BN;
  amount: BN;
  positionType: PositionType;
  unlockTime: BN;
  status: PositionStatus;
  nftMint: PublicKey;
  bump: number;
}