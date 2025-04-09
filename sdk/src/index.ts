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
import { LockPeriod, PositionType } from "./types";
import { getAllLockPeriods, getLockPeriodFromIdl } from "./utils";

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
    id,
    authority,
    mint,
    collection,
    lockPeriodYields,
    nftsVault,
    maxCap,
    nftValueInTokens,
    nftsLimitPerUser,
  }: {
    id: number;
    authority: PublicKey;
    mint: PublicKey;
    collection: PublicKey;
    nftsVault?: PublicKey;
    lockPeriodYields: Map<LockPeriod, BN | number>;
    maxCap: number | BN;
    nftValueInTokens: number | BN;
    nftsLimitPerUser: number;
  }): Promise<TransactionInstruction> {
    return initializeInstruction({
      program: this.program,
      pda: this.pda,
      id,
      authority,
      mint,
      collection,
      nftsVault,
      lockPeriodYields,
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
    lockPeriodYields,
    nftsVault,
    maxCap,
    nftValueInTokens,
    nftsLimitPerUser,
  }: {
    authority: PublicKey;
    mint: PublicKey;
    collection: PublicKey;
    lockPeriodYields?: Map<LockPeriod, number | BN>;
    nftsVault?: PublicKey; // Added optional nftsVault
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
      nftsVault,
      lockPeriodYields, // Changed from lockPeriod to lockPeriods
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
    configId,
    positionId,
    owner,
    tokenMint,
    lockPeriodYieldIndex,
    positionType,
  }: {
    authority: PublicKey;
    configId?: number;
    positionId: number;
    owner: PublicKey;
    tokenMint: PublicKey;
    lockPeriodYieldIndex: number;
    positionType: PositionType;
  }): Promise<TransactionInstruction> {
    return initializePositionInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      configId,
      positionId,
      tokenMint,
      lockPeriodYieldIndex,
      positionType,
    });
  }

  /**
   * Creates an RPC call to initialize a user position
   */
  async initializePositionRpc({
    authority,
    owner,
    tokenMint,
    lockPeriodYieldIndex,
    positionType,
  }: {
    authority: PublicKey;
    owner: PublicKey;
    tokenMint: PublicKey;
    lockPeriodYieldIndex: number;
    positionType: PositionType;
  }): Promise<string> {
    let ix = await initializePositionInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      tokenMint,
      lockPeriodYieldIndex,
      positionType,
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
    configId,
    positionId,
    mint,
    collection,
    asset,
    updateAuthority,
    payer,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    configId: number;
    positionId: number;
    mint: PublicKey;
    collection: PublicKey;
    asset: PublicKey;
    updateAuthority: PublicKey;
    payer: PublicKey;
  }): Promise<TransactionInstruction> {
    return stakeNftInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      configId,
      positionId,
      authority,
      mint,
      collection,
      asset,
      updateAuthority,
      payer,
    });
  }

  /**
   * Creates an RPC call to stake an NFT
   */
  async stakeNftRpc({
    owner,
    authority,
    mint,
    collection,
    asset,
    updateAuthority,
    payer,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    mint: PublicKey;
    collection: PublicKey;
    asset: PublicKey;
    updateAuthority: PublicKey;
    payer: PublicKey;
  }): Promise<string> {
    let ix = await stakeNftInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      mint,
      collection,
      asset,
      updateAuthority,
      payer,
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
    configId,
    positionId,
    owner,
    tokenMint,
    amount,
    tokenAccount,
    vault,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    configId?: number;
    positionId: number;
    tokenMint: PublicKey;
    amount: number | BN;
    tokenAccount?: PublicKey;
    vault?: PublicKey;
  }): Promise<TransactionInstruction> {
    return await stakeTokenInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      configId,
      positionId,
      authority,
      tokenMint,
      amount,
      tokenAccount,
      vault,
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
    tokenAccount,
    vault,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    tokenMint: PublicKey;
    amount: number | BN;
    tokenAccount?: PublicKey;
    vault?: PublicKey;
  }): Promise<string> {
    let ix = await stakeTokenInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      tokenMint,
      amount,
      tokenAccount,
      vault,
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
    authority = this.provider.publicKey,
    owner,
    positionPda,
    configId,
    tokenMint,
    nftMint,
    tokenAccount,
    nftTokenAccount,
    collection,
    nftsVault,
    vault,
  }: {
    authority?: PublicKey;
    owner: PublicKey;
    configId: number;
    positionPda?: PublicKey;
    tokenMint: PublicKey;
    nftMint?: PublicKey;
    tokenAccount?: PublicKey;
    nftTokenAccount?: PublicKey;
    collection?: PublicKey;
    nftsVault?: PublicKey;
    vault?: PublicKey;
  }): Promise<TransactionInstruction> {
    return claimPositionInstruction({
      program: this.program,
      sdk: this,
      authority,
      configId,
      owner,
      positionPda,
      tokenMint,
      nftMint,
      tokenAccount,
      nftTokenAccount,
      collection,
      nftsVault,
      vault,
    });
  }

  /**
   * Creates an RPC call to claim a staking position
   */
  async claimPositionRpc({
    authority = this.provider.publicKey,
    owner,
    positionPda,
    tokenMint,
    nftMint,
    tokenAccount,
    nftTokenAccount,
    collection,
    nftsVault,
    vault,
  }: {
    authority?: PublicKey;
    owner: PublicKey;
    positionPda?: PublicKey;
    tokenMint: PublicKey;
    nftMint?: PublicKey;
    tokenAccount?: PublicKey;
    nftTokenAccount?: PublicKey;
    collection?: PublicKey;
    nftsVault?: PublicKey;
    vault?: PublicKey;
  }): Promise<string> {
    let ix = await claimPositionInstruction({
      program: this.program,
      sdk: this,
      authority,
      owner,
      positionPda,
      tokenMint,
      nftMint,
      tokenAccount,
      nftTokenAccount,
      collection,
      nftsVault,
      vault,
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
  async fetchPosition(owner: PublicKey, id: number, mint: PublicKey) {
    return fetchPositionRpc(owner, mint, id, this.program);
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

  static getSupportedLockPeriods() {
    return getAllLockPeriods();
  }

  static getLockPeriodFromIdl(p: LockPeriod) {
    return getLockPeriodFromIdl(p);
  }
}
