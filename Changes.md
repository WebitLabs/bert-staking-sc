# BERT Staking Protocol - Dynamic Pools Feature Changes

Changes introduced in the `feature/dynamic-pools` branch. These changes are designed to make pool management more flexible.

## Core Architectural Changes

### 1. Pool Account Separation

The most significant change is the separation of pool configurations from the main Config account into standalone Pool accounts.

**Before**: Pool configurations were embedded directly in the Config account, limiting flexibility and scalability.
**After**: Each pool now has its own separate on-chain account with a unique PDA address.

### 2. User Pool Stats Introduction

A new `UserPoolStats` account type has been introduced to track staking metrics on a per-user and per-pool basis.

**Before**: User stats were tracked globally in the User account.
**After**: User stats are now tracked separately for each pool, enabling per-pool limits and metrics.

### 3. Initialization Flow Changes

The initialization flow for user accounts and staking has changed significantly:

**Before**: User pool stats were initialized during user account creation.
**After**: User pool stats are now initialized during the first staking operation (using Anchor's `init_if_needed` constraint).

## Key Account Changes

### Pool Account

- New dedicated account type
- PDA derivation: `["pool", config_pda, index]`
- Fields:
  - `config` - Reference to the parent Config account
  - `index` - Pool's numerical index (for easy reference)
  - `lockPeriodDays` - Lock period in days
  - `yieldRate` - Yield rate in basis points (100 = 1%)
  - `maxNftsCap` - Maximum NFTs allowed in this pool
  - `maxTokensCap` - Maximum tokens allowed in this pool
  - `isPaused` - Flag indicating if the pool is currently paused
  - `bump` - PDA bump seed

### UserPoolStats Account

- New account type for tracking per-pool user metrics
- PDA derivation: `["user_pool_stats", user_pubkey, pool_pda]`
- Fields:
  - `user` - User public key
  - `pool` - Reference to the Pool account
  - `tokensStaked` - Amount of tokens staked in this pool
  - `nftsStaked` - Number of NFTs staked in this pool
  - `totalValue` - Total value staked (in tokens)
  - `claimedYield` - Total claimed yield from this pool
  - `bump` - PDA bump seed

### Position Account (Updated)

- Added a new field: `pool` - Reference to the Pool account used for this position
- Positions are now directly linked to their respective pool

### Config Account

- Removed embedded pool configurations
- Pool configurations are now stored in separate Pool accounts

## Instruction Changes

### Initialize

- Now only initializes the basic Config account
- Pool initialization is now done separately via `initializePool`

### InitializePool (New)

- New instruction to initialize a specific pool with its own configuration
- Creates a standalone Pool account with configurable parameters

### InitializeUser

- No longer creates user pool stats accounts
- Simpler function that only creates the basic user account

### StakeToken & StakeNft

- Now conditionally initialize user pool stats if they don't exist
- Use `init_if_needed` constraint for user pool stats
- Enforce per-pool limits instead of global limits

### ClaimToken & ClaimNft

- Now require the pool index to properly identify the user pool stats
- User pool stats are derived from position.pool instead of global pool configurations

### AdminSetPoolConfig

- Updated to work directly with Pool accounts instead of updating the Config account
- More focused and efficient updates to pool parameters

### AdminPausePool & AdminActivatePool

- Updated to work with separate Pool accounts
- More granular control over individual pools

## SDK Changes

### New Functions

- `findPoolPda` - Derives the PDA for a pool by index and config
- `findUserPoolStatsPda` - Derives the PDA for user pool stats by user and pool
- `fetchPoolByAddress` - Fetches pool data by address
- `fetchPoolByAddressRpc` - RPC version of fetch pool
- `fetchPoolsByConfig` - Fetches all pools for a given config
- `fetchUserPoolStatsByAddress` - Fetches user pool stats by address
- `fetchUserPoolStatsByAddressRpc` - RPC version of fetch user pool stats
- `fetchUserPoolStatsByUser` - Fetches all user pool stats for a given user

### Modified Functions

- `initializeRpc` - Now handles config initialization, authority vault, and pool initialization in separate steps
- `stakeTokenRpc` & `stakeNftRpc` - Now require pool index and handle user pool stats initialization
- `claimTokenPositionRpc` & `claimNftPositionRpc` - Now require pool index for proper user pool stats derivation

## Integration Instructions for Frontend Developers

### 1. Pool Management

- You must now specify a `poolIndex` for all staking and claiming operations
- Fetch pools using `sdk.fetchPoolsByConfig(configPda)` to get all available pools
- Display each pool's parameters, including lock period, yield rate, and limits

### 2. User Pool Stats

- Before displaying staking interfaces, fetch user pool stats:
  ```typescript
  const [poolPda] = sdk.pda.findPoolPda(configPda, poolIndex);
  const [userPoolStatsPda] = sdk.pda.findUserPoolStatsPda(userWallet, poolPda);
  const userPoolStats = await sdk.fetchUserPoolStatsByAddress(userPoolStatsPda);
  ```
- Stats may not exist until after first stake, so handle that case gracefully

### 3. Staking Flow

- When staking tokens or NFTs, you need to specify the pool index:
  ```typescript
  await sdk.stakeTokenRpc({
    owner: wallet.publicKey,
    tokenMint,
    amount: new BN(amount),
    poolIndex, // This is now required
    // other parameters...
  });
  ```

### 4. Claiming Flow

- When claiming positions, you must also specify the pool index:

  ```typescript
  // Fetch the position first to get its pool
  const position = await sdk.fetchPositionByAddress(positionPda);

  // Get the pool index from the pool reference
  const pool = await sdk.fetchPoolByAddress(position.pool);
  const poolIndex = pool.index;

  // Now claim with the pool index
  await sdk.claimTokenPositionRpc({
    owner: wallet.publicKey,
    positionPda,
    poolIndex, // This is now required
    // other parameters...
  });
  ```

### 5. Position Display

- Positions now contain a reference to their pool account
- When displaying position details, you should fetch and show the associated pool information:

  ```typescript
  const position = await sdk.fetchPositionByAddress(positionPda);
  const pool = await sdk.fetchPoolByAddress(position.pool);

  // Now display pool details like lock period and yield rate
  ```

### 6. Error Handling

- Handle cases where user pool stats don't exist yet
- If a position's pool reference doesn't match the expected pool, this can cause claims to fail

## Transaction Sequence Examples

### Staking Tokens

1. Find the Config PDA: `sdk.pda.findConfigPda(authority, configId)`
2. Find the Pool PDA: `sdk.pda.findPoolPda(configPda, poolIndex)`
3. Check if user account exists, initialize if needed
4. Stake tokens with pool index: `sdk.stakeTokenRpc({..., poolIndex})`
5. Fetch and display the new position and updated user pool stats

### Claiming NFTs

1. Fetch the position: `sdk.fetchPositionByAddress(positionPda)`
2. Get the pool from the position: `position.pool`
3. Find user pool stats PDA: `sdk.pda.findUserPoolStatsPda(owner, position.pool)`
4. Get the pool index: `(await sdk.fetchPoolByAddress(position.pool)).index`
5. Claim with the pool index: `sdk.claimNftPositionRpc({..., poolIndex})`
6. Fetch and display the updated user pool stats

