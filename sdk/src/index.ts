import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import { BertStakingSc } from "./idl";
import * as IDL from "./idl.json";

// Import the PDA helpers
import { BertStakingPda } from "./pda";

// Import instruction creators
import {
  initializeInstruction,
  initializePositionInstruction,
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
import { LockPeriod } from "./types";

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
    mint,
    collection,
    lockPeriod,
    yieldRate,
    maxCap,
    nftValueInTokens,
    nftsLimitPerUser,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    collection: PublicKey;
    lockPeriod: LockPeriod;
    yieldRate: number | BN;
    maxCap: number | BN;
    nftValueInTokens: number | BN;
    nftsLimitPerUser: number;
  }): Promise<TransactionInstruction> {
    return initializeInstruction({
      program: this.program,
      pda: this.pda,
      authority,
      mint,
      collection,
      lockPeriod,
      yieldRate,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });
  }

  /**
   * Creates an call to RPC to initialize the staking program
   */
  async initializeRpc({
    authority,
    mint,
    collection,
    lockPeriod,
    yieldRate,
    maxCap,
    nftValueInTokens,
    nftsLimitPerUser,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    collection: PublicKey;
    lockPeriod: LockPeriod;
    yieldRate: number | BN;
    maxCap: number | BN;
    nftValueInTokens: number | BN;
    nftsLimitPerUser: number;
  }): Promise<string> {
    let ix = await initializeInstruction({
      program: this.program,
      pda: this.pda,
      authority,
      mint,
      collection,
      lockPeriod,
      yieldRate,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });

    const tx = new Transaction();

    const latestBlockhash = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;

    tx.add(ix);

    if (this.provider.sendAndConfirm) {
      return await this.provider.sendAndConfirm(tx);
    }

    return "";
  }

  /**
   * Creates an instruction to initialize a user position
   */
  async initializePosition({
    authority,
    owner,
    tokenMint,
  }: {
    authority: PublicKey;
    owner: PublicKey;
    tokenMint: PublicKey;
  }): Promise<TransactionInstruction> {
    return initializePositionInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      tokenMint,
    });
  }

  /**
   * Creates an RPC call to initialize a user position
   */
  async initializePositionRpc({
    authority,
    owner,
    tokenMint,
  }: {
    authority: PublicKey;
    owner: PublicKey;
    tokenMint: PublicKey;
  }): Promise<string> {
    let ix = await initializePositionInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      tokenMint,
    });

    const tx = new Transaction();

    const latestBlockhash = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;

    tx.add(ix);

    if (this.provider.sendAndConfirm) {
      return await this.provider.sendAndConfirm(tx);
    }

    return "";
  }

  /**
   * Creates an instruction to stake an NFT
   */
  async stakeNft({
    owner,
    authority,
    nftMint,
    nftTokenAccount,
    programNftAccount,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    nftMint: PublicKey;
    nftTokenAccount?: PublicKey;
    programNftAccount?: PublicKey;
  }): Promise<TransactionInstruction> {
    return stakeNftInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      nftMint,
      nftTokenAccount,
      programNftAccount,
    });
  }

  /**
   * Creates an RPC call to stake an NFT
   */
  async stakeNftRpc({
    owner,
    authority,
    nftMint,
    nftTokenAccount,
    programNftAccount,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    nftMint: PublicKey;
    nftTokenAccount?: PublicKey;
    programNftAccount?: PublicKey;
  }): Promise<string> {
    let ix = await stakeNftInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      nftMint,
      nftTokenAccount,
      programNftAccount,
    });

    const tx = new Transaction();

    const latestBlockhash = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;

    tx.add(ix);

    if (this.provider.sendAndConfirm) {
      return await this.provider.sendAndConfirm(tx);
    }

    return "";
  }

  /**
   * Creates an instruction to stake tokens
   */
  async stakeToken({
    authority,
    owner,
    tokenMint,
    amount,
    period,
    tokenAccount,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    tokenMint: PublicKey;
    amount: number | BN;
    period: LockPeriod;
    tokenAccount?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await stakeTokenInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      tokenMint,
      amount,
      period,
      tokenAccount,
    });
  }

  /**
   * Creates an instruction to stake tokens
   */
  async stakeTokenRpc({
    authority,
    owner,
    tokenMint,
    amount,
    period,
    tokenAccount,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    tokenMint: PublicKey;
    amount: number | BN;
    period: LockPeriod;
    tokenAccount?: PublicKey;
  }): Promise<string> {
    let ix = await stakeTokenInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      tokenMint,
      amount,
      period,
      tokenAccount,
    });

    const tx = new Transaction();

    const latestBlockhash = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;

    tx.add(ix);

    if (this.provider.sendAndConfirm) {
      return await this.provider.sendAndConfirm(tx);
    }

    return "";
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
   * Creates an instruction to claim a staking position
   */
  async claimPositionRpc({
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
  }): Promise<string> {
    let ix = await claimPositionInstruction({
      program: this.program,
      owner,
      positionPda,
      tokenMint,
      tokenAccount,
      programTokenAccount,
    });

    const tx = new Transaction();

    const latestBlockhash = await this.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;

    tx.add(ix);

    if (this.provider.sendAndConfirm) {
      return await this.provider.sendAndConfirm(tx);
    }

    return "";
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
