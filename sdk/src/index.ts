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
  initializeUserInstruction,
  stakeNftInstruction,
  stakeTokenInstruction,
  claimTokenPositionInstruction,
  claimNftPositionInstruction,
  adminSetPoolConfigInstruction,
  adminPausePoolInstruction,
  adminActivatePoolInstruction,
  adminWithdrawTokenInstruction,
} from "./instructions";

// Import account functions
import {
  fetchConfigRpc,
  fetchConfigByAddressRpc,
  fetchPositionRpc,
  fetchPositionByAddressRpc,
  fetchPositionsByOwnerRpc,
  fetchUserAccountRpc,
  fetchUserAccountByAddressRpc,
} from "./accounts";
import { PoolConfigArgs, PositionType } from "./types";
import { getStandardLockPeriodDays, PoolConfigParams } from "./utils";

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
    poolsConfig,
    vault,
    nftsVault,
    maxNftsCap,
    maxTokensCap,
    maxCap,
    nftValueInTokens,
    nftsLimitPerUser,
  }: {
    id: number;
    authority: PublicKey;
    mint: PublicKey;
    collection: PublicKey;
    vault?: PublicKey;
    nftsVault?: PublicKey;
    poolsConfig?: PoolConfigParams[];
    maxNftsCap?: number;
    maxTokensCap?: number | BN;
    defaultYieldRate?: number | BN;
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
      vault,
      nftsVault,
      poolsConfig,
      maxNftsCap,
      maxTokensCap,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });
  }

  /**
   * Creates an call to RPC to initialize the staking program
   */
  async initializeRpc({
    id,
    authority,
    mint,
    collection,
    poolsConfig,
    vault,
    nftsVault,
    maxNftsCap,
    maxTokensCap,
    maxCap,
    nftValueInTokens,
    nftsLimitPerUser,
    defaultYieldRate,
  }: {
    id: number;
    authority: PublicKey;
    mint: PublicKey;
    collection: PublicKey;
    poolsConfig?: PoolConfigParams[];
    vault?: PublicKey;
    nftsVault?: PublicKey;
    maxNftsCap?: number;
    maxTokensCap?: number | BN;
    defaultYieldRate?: number | BN;
    maxCap: number | BN;
    nftValueInTokens: number | BN;
    nftsLimitPerUser: number;
  }): Promise<string> {
    let ix = await initializeInstruction({
      program: this.program,
      pda: this.pda,
      id,
      authority,
      mint,
      collection,
      vault,
      nftsVault,
      poolsConfig,
      defaultYieldRate,
      maxNftsCap,
      maxTokensCap,
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
   * Creates an instruction to initialize a user account
   */
  async initializeUser({
    owner,
    authority,
    configId,
    mint,
  }: {
    owner: PublicKey;
    authority?: PublicKey;
    configId?: number;
    mint: PublicKey;
  }): Promise<TransactionInstruction> {
    return initializeUserInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      configId,
      mint,
    });
  }

  /**
   * Creates an RPC call to initialize a user account
   */
  async initializeUserRpc({
    owner,
    authority,
    configId,
    mint,
  }: {
    owner: PublicKey;
    authority?: PublicKey;
    configId?: number;
    mint: PublicKey;
  }): Promise<string> {
    const ix = await initializeUserInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      configId,
      mint,
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
    poolIndex,
    mint,
    collection,
    asset,
    nftsVault,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    configId?: number;
    positionId?: number;
    poolIndex: number;
    mint: PublicKey;
    collection: PublicKey;
    asset: PublicKey;
    nftsVault?: PublicKey;
  }): Promise<TransactionInstruction> {
    return stakeNftInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      configId,
      positionId,
      poolIndex,
      authority,
      mint,
      collection,
      asset,
      nftsVault,
    });
  }

  /**
   * Creates an RPC call to stake an NFT
   */
  async stakeNftRpc({
    owner,
    authority,
    configId,
    positionId,
    poolIndex,
    mint,
    collection,
    asset,
    nftsVault,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    configId?: number;
    positionId?: number;
    poolIndex: number;
    mint: PublicKey;
    collection: PublicKey;
    asset: PublicKey;
    nftsVault?: PublicKey;
  }): Promise<string> {
    let ix = await stakeNftInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      configId,
      positionId,
      poolIndex,
      mint,
      collection,
      asset,
      nftsVault,
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
    poolIndex,
    tokenAccount,
    vault,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    configId?: number;
    positionId?: number;
    tokenMint: PublicKey;
    amount: number | BN;
    poolIndex: number;
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
      poolIndex,
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
    configId,
    positionId,
    tokenMint,
    amount,
    poolIndex,
    tokenAccount,
    vault,
  }: {
    owner: PublicKey;
    authority: PublicKey;
    tokenMint: PublicKey;
    configId?: number;
    positionId?: number;
    amount: number | BN;
    poolIndex: number;
    tokenAccount?: PublicKey;
    vault?: PublicKey;
  }): Promise<string> {
    let ix = await stakeTokenInstruction({
      program: this.program,
      pda: this.pda,
      owner,
      authority,
      tokenMint,
      configId,
      positionId,
      amount,
      poolIndex,
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
   * Creates an instruction to claim a token staking position
   */
  async claimTokenPosition({
    authority = this.provider.publicKey,
    owner,
    positionPda,
    configId,
    tokenMint,
    tokenAccount,
    collection,
    vault,
    positionId = 0,
  }: {
    authority?: PublicKey;
    owner: PublicKey;
    configId?: number;
    positionPda?: PublicKey;
    tokenMint: PublicKey;
    tokenAccount?: PublicKey;
    collection?: PublicKey;
    vault?: PublicKey;
    positionId?: number;
  }): Promise<TransactionInstruction> {
    return claimTokenPositionInstruction({
      program: this.program,
      sdk: this,
      authority,
      owner,
      positionPda,
      tokenMint,
      tokenAccount,
      collection,
      vault,
      configId,
      positionId,
    });
  }

  /**
   * Creates an RPC call to claim a token staking position
   */
  async claimTokenPositionRpc({
    authority = this.provider.publicKey,
    owner,
    positionPda,
    configId = 0,
    tokenMint,
    tokenAccount,
    collection,
    vault,
    positionId = 0,
  }: {
    authority?: PublicKey;
    owner: PublicKey;
    configId?: number;
    positionPda?: PublicKey;
    tokenMint: PublicKey;
    tokenAccount?: PublicKey;
    collection?: PublicKey;
    vault?: PublicKey;
    positionId?: number;
  }): Promise<string> {
    const ix = await claimTokenPositionInstruction({
      program: this.program,
      sdk: this,
      authority,
      owner,
      positionPda,
      tokenMint,
      tokenAccount,
      collection,
      vault,
      configId,
      positionId,
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
   * Creates an instruction to claim an NFT staking position
   */
  async claimNftPosition({
    authority = this.provider.publicKey,
    owner,
    payer,
    positionPda,
    configId = 0,
    positionId = 0,
    tokenMint,
    asset,
    tokenAccount,
    collection,
    updateAuthority,
    vault,
  }: {
    authority?: PublicKey;
    owner: PublicKey;
    payer: PublicKey;
    configId?: number;
    positionId?: number;
    positionPda?: PublicKey;
    asset: PublicKey;
    tokenMint: PublicKey;
    tokenAccount?: PublicKey;
    collection?: PublicKey;
    updateAuthority: PublicKey;
    vault?: PublicKey;
  }): Promise<TransactionInstruction> {
    return claimNftPositionInstruction({
      program: this.program,
      sdk: this,
      authority,
      owner,
      payer,
      positionPda,
      positionId,
      asset,
      tokenMint,
      tokenAccount,
      collection,
      updateAuthority,
      vault,
      configId,
    });
  }

  /**
   * Creates an RPC call to claim an NFT staking position
   */
  async claimNftPositionRpc({
    authority = this.provider.publicKey,
    owner,
    payer,
    positionPda,
    configId = 0,
    positionId = 0,
    asset,
    tokenMint,
    tokenAccount,
    collection,
    updateAuthority,
    vault,
  }: {
    authority?: PublicKey;
    owner: PublicKey;
    payer: PublicKey;
    configId?: number;
    positionId?: number;
    positionPda?: PublicKey;
    asset: PublicKey;
    tokenMint: PublicKey;
    tokenAccount?: PublicKey;
    collection?: PublicKey;
    updateAuthority: PublicKey;
    vault?: PublicKey;
  }): Promise<string> {
    const ix = await claimNftPositionInstruction({
      program: this.program,
      sdk: this,
      authority,
      owner,
      payer,
      positionId,
      positionPda,
      asset,
      tokenMint,
      tokenAccount,
      collection,
      updateAuthority,
      vault,
      configId,
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
   * @param owner The owner public key
   * @param id For token positions, the position ID
   * @param mint The token mint public key
   * @param asset For NFT positions, the asset public key
   * @returns The position account if found, null otherwise
   */
  async fetchPosition(
    owner: PublicKey,
    id: number,
    mint: PublicKey,
    asset?: PublicKey
  ) {
    return fetchPositionRpc(owner, mint, id, asset || null, this.program);
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
   * Fetches a user account for a given owner and config
   */
  async fetchUserAccount(owner: PublicKey, config: PublicKey) {
    return fetchUserAccountRpc(owner, config, this.program);
  }

  /**
   * Fetches a user account by address
   */
  async fetchUserAccountByAddress(userAccountAddress: PublicKey) {
    return fetchUserAccountByAddressRpc(userAccountAddress, this.program);
  }

  /**
   * Creates an instruction to set pool configuration
   */
  async adminSetPoolConfig({
    authority,
    configId,
    poolIndex,
    poolConfigArgs,
  }: {
    authority: PublicKey;
    configId?: number;
    poolIndex: number;
    poolConfigArgs: PoolConfigArgs;
  }): Promise<TransactionInstruction> {
    return adminSetPoolConfigInstruction({
      program: this.program,
      pda: this.pda,
      authority,
      configId,
      poolIndex,
      poolConfigArgs,
    });
  }

  /**
   * Creates an instruction to pause a pool
   */
  async adminPausePool({
    authority,
    configId,
    poolIndex,
  }: {
    authority: PublicKey;
    configId?: number;
    poolIndex: number;
  }): Promise<TransactionInstruction> {
    return adminPausePoolInstruction({
      program: this.program,
      pda: this.pda,
      authority,
      configId,
      poolIndex,
    });
  }

  /**
   * Creates an instruction to activate a pool
   */
  async adminActivatePool({
    authority,
    configId,
    poolIndex,
  }: {
    authority: PublicKey;
    configId?: number;
    poolIndex: number;
  }): Promise<TransactionInstruction> {
    return adminActivatePoolInstruction({
      program: this.program,
      pda: this.pda,
      authority,
      configId,
      poolIndex,
    });
  }

  /**
   * Creates an instruction to withdraw tokens
   */
  async adminWithdrawToken({
    authority,
    destination,
    configId,
    tokenMint,
    amount,
    vault,
    destinationTokenAccount,
  }: {
    authority: PublicKey;
    destination: PublicKey;
    configId?: number;
    tokenMint: PublicKey;
    amount: number | BN;
    vault?: PublicKey;
    destinationTokenAccount?: PublicKey;
  }): Promise<TransactionInstruction> {
    return adminWithdrawTokenInstruction({
      program: this.program,
      pda: this.pda,
      authority,
      destination,
      configId,
      tokenMint,
      amount,
      vault,
      destinationTokenAccount,
    });
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

  static getSupportedLockPeriodDays() {
    return getStandardLockPeriodDays();
  }
}
