import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Connection, TransactionInstruction } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import { BertStakingSc } from "./idl";
import * as IDL from "./idl.json";

// Import the PDA helpers
import { BertStakingPda } from "./pda";

// Import instruction creators
import {
  initializeInstruction,
  stakeNftInstruction,
  stakeTokenInstruction,
  claimPositionInstruction,
} from "./instructions";

// Import account functions
import {
  fetchConfigRpc,
  fetchConfigByAddressRpc,
  fetchPositionRpc,
  fetchPositionByAddressRpc,
  fetchPositionsByOwnerRpc,
} from "./accounts";

// Export types
export * from "./types";
export * from "./pda";
export * from "./instructions";
export * from "./accounts";

/**
 * Main SDK class for interacting with the Bert Staking program
 */
export class BertStakingSDK {
  public program: Program<BertStakingSc>;
  public pda: BertStakingPda;

  /**
   * Creates a new instance of the BertStakingSDK
   * @param provider An AnchorProvider or a connection and wallet pair
   * @param programId The program ID (optional, defaults to IDL.address)
   */
  constructor(
    public provider: AnchorProvider | BankrunProvider,
    public programId: PublicKey = new PublicKey(IDL.address)
  ) {
    this.program = new Program(IDL as any, provider);
    this.pda = new BertStakingPda(programId);
  }

  /**
   * Creates an instruction to initialize the staking program
   */
  async initialize({
    authority,
    lockTime,
    yieldRate,
    maxCap,
    nftValueInTokens,
    nftsLimitPerUser,
  }: {
    authority: PublicKey;
    lockTime: number | BN;
    yieldRate: number | BN;
    maxCap: number | BN;
    nftValueInTokens: number | BN;
    nftsLimitPerUser: number;
  }): Promise<TransactionInstruction> {
    return initializeInstruction({
      program: this.program,
      authority,
      lockTime,
      yieldRate,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });
  }

  /**
   * Creates an instruction to stake an NFT
   */
  async stakeNft({
    owner,
    nftMint,
    nftTokenAccount,
    programNftAccount,
  }: {
    owner: PublicKey;
    nftMint: PublicKey;
    nftTokenAccount?: PublicKey;
    programNftAccount?: PublicKey;
  }): Promise<TransactionInstruction> {
    return stakeNftInstruction({
      program: this.program,
      owner,
      nftMint,
      nftTokenAccount,
      programNftAccount,
    });
  }

  /**
   * Creates an instruction to stake tokens
   */
  async stakeToken({
    owner,
    tokenMint,
    amount,
    tokenAccount,
    programTokenAccount,
  }: {
    owner: PublicKey;
    tokenMint: PublicKey;
    amount: number | BN;
    tokenAccount?: PublicKey;
    programTokenAccount?: PublicKey;
  }): Promise<TransactionInstruction> {
    return stakeTokenInstruction({
      program: this.program,
      owner,
      tokenMint,
      amount,
      tokenAccount,
      programTokenAccount,
    });
  }

  /**
   * Creates an instruction to claim a staking position
   */
  async claimPosition({
    owner,
    positionPda,
    tokenMint,
    tokenAccount,
    programTokenAccount,
  }: {
    owner: PublicKey;
    positionPda: PublicKey;
    tokenMint: PublicKey;
    tokenAccount?: PublicKey;
    programTokenAccount?: PublicKey;
  }): Promise<TransactionInstruction> {
    return claimPositionInstruction({
      program: this.program,
      owner,
      positionPda,
      tokenMint,
      tokenAccount,
      programTokenAccount,
    });
  }

  /**
   * Fetches a config account for a given authority
   */
  async fetchConfig(authority: PublicKey) {
    return fetchConfigRpc(authority, this.program);
  }

  /**
   * Fetches a config account by address
   */
  async fetchConfigByAddress(configAddress: PublicKey) {
    return fetchConfigByAddressRpc(configAddress, this.program);
  }

  /**
   * Fetches a position account for a given owner and mint
   */
  async fetchPosition(owner: PublicKey, mint: PublicKey) {
    return fetchPositionRpc(owner, mint, this.program);
  }

  /**
   * Fetches a position account by address
   */
  async fetchPositionByAddress(positionAddress: PublicKey) {
    return fetchPositionByAddressRpc(positionAddress, this.program);
  }

  /**
   * Fetches all position accounts for a given owner
   */
  async fetchPositionsByOwner(owner: PublicKey) {
    return fetchPositionsByOwnerRpc(owner, this.program);
  }

  /**
   * Static method to create the SDK from a Connection and wallet
   */
  static fromConnection(
    connection: Connection,
    wallet: {
      publicKey: PublicKey;
      signTransaction: any;
      signAllTransactions: any;
    },
    programId?: PublicKey
  ): BertStakingSDK {
    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );
    return new BertStakingSDK(provider, programId);
  }
}

