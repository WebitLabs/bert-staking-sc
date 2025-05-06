# BERT Staking Smart Contract

A Solana program for staking tokens and NFTs with configurable yield rates and lock periods.

## Repository Structure

- `/programs` - Solana program written in Rust
- `/sdk` - TypeScript SDK for interacting with the program
- `/cli` - Command-line interface for easy program interaction
- `/tests` - Program tests using Bankrun

## Setup & Installation

### Prerequisites

- Rust & Cargo (latest stable)
- Node.js & Yarn
- Solana CLI tools

### Build the Program

```bash
# Install Solana dependencies
yarn install

# Build the Solana program
anchor build
```

### Test the Program

```bash
# Run the main staking tests
yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/bert-staking-sc.ts

# Run the admin functionality tests
yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/bert-staking-sc-admin.ts
```

### Build the SDK

```bash
# Install SDK dependencies
cd sdk
yarn install

# Build the SDK
yarn build
```

### Build the CLI

```bash
# Install CLI dependencies
cd cli
yarn install

# Build the CLI
yarn build

# Link CLI globally (optional)
npm link
```

## Using the CLI

The CLI provides commands for all staking operations with intuitive options.

### Configuration & Setup

```bash
# Initialize the staking program (with pools config)
cd cli
ts-node ./src/index.ts initialize \
   --config-id 10 \
   --collection 3K3fmD9vap7bcCLSXc8Av6PbjaTpCFVZFDc44ddU7taK \
   --max-cap 250000 \
   --nft-value 50000 \
   --nft-limit 3 \
   --pool1-yield 500 \
   --pool3-yield 800 \
   --pool7-yield 1200 \
   --pool30-yield 1800 \
   --max-nfts 3 \
   --max-tokens 250000

# View program configuration
ts-node ./src/index.ts fetch-config --config-id 1

ts-node ./src/index.ts fetch-config -c <config-pubkey>

```

### Staking Operations

```bash
# Stake tokens (includes auto user initialization)
ts-node ./src/index.ts stake-token --amount 500 --pool-index 2 --position-id 42

# Stake NFT (includes auto user initialization)
ts-node ./src/index.ts stake-nft --asset <NFT_ADDRESS> --pool-index 3 --position-id 100

# Claim tokens with yield after lock period
ts-node ./src/index.ts claim-token --position-id 42 --token-mint <TOKEN_MINT>

# Claim NFT with yield after lock period
ts-node ./src/index.ts claim-nft --asset <NFT_ADDRESS> --collection <COLLECTION_MINT> --update-authority <UPDATE_AUTHORITY> --position-id 100
```

### Query Commands

```bash
# View all your positions
ts-node ./src/index.ts fetch-position --all

# View specific token position
ts-node ./src/index.ts fetch-position --position-id 42 --token-mint <TOKEN_MINT>

# View specific NFT position
ts-node ./src/index.ts fetch-position --position-id 100 --asset <NFT_ADDRESS> --token-mint <TOKEN_MINT>
```

### Admin Commands

```bash
# Pause a pool
ts-node ./src/index.ts admin:pause-pool --pool-index 2 --config-id 1

# Activate a paused pool
ts-node ./src/index.ts admin:activate-pool --pool-index 2 --config-id 1

# Update pool configuration
ts-node ./src/index.ts admin:set-pool-config --pool-index 1 --yield-rate 500 --max-nfts 1000 --max-tokens 1000000000 --config-id 1

# Withdraw tokens from protocol
ts-node ./src/index.ts admin:withdraw-tokens --amount 1000 --token-mint <TOKEN_MINT> --destination <DESTINATION_PUBKEY> --config-id 1
```

## Using the SDK

```typescript
import { BertStakingSDK } from "@bert-staking/sdk";
import { Connection, PublicKey, BN } from "@solana/web3.js";

// Create SDK instance
const connection = new Connection("https://api.devnet.solana.com");
const sdk = BertStakingSDK.fromConnection(connection, wallet);

// Initialize user account (if not already initialized)
const configId = 1;
const [configPda] = sdk.pda.findConfigPda(wallet.publicKey, configId);
const tokenMint = new PublicKey("TOKEN_MINT_ADDRESS");

try {
  await sdk.initializeUserRpc({
    owner: wallet.publicKey,
    authority: wallet.publicKey,
    configId,
    mint: tokenMint,
  });
} catch (err) {
  // Handle case where user account already exists
  console.log("User account already exists or error:", err);
}

// Stake tokens
const txid = await sdk.stakeTokenRpc({
  authority: wallet.publicKey,
  owner: wallet.publicKey,
  configId,
  positionId: 42, // Optional custom position ID
  tokenMint,
  amount: new BN(500 * 10 ** 6), // 500 tokens with 6 decimals
  poolIndex: 2, // Pool with 7-day lock period
});

// Stake NFT
const nftTxid = await sdk.stakeNftRpc({
  authority: wallet.publicKey,
  owner: wallet.publicKey,
  configId,
  positionId: 100, // Optional custom position ID for NFT
  mint: tokenMint,
  collection: new PublicKey("COLLECTION_ADDRESS"),
  asset: new PublicKey("NFT_ASSET_ADDRESS"),
  poolIndex: 3, // Pool with 30-day lock period
});

// Claim tokens after lock period
const claimTxid = await sdk.claimTokenPositionRpc({
  authority: wallet.publicKey,
  owner: wallet.publicKey,
  configId,
  positionId: 42,
  tokenMint,
});

// Claim NFT after lock period
const claimNftTxid = await sdk.claimNftPositionRpc({
  authority: wallet.publicKey,
  owner: wallet.publicKey,
  payer: wallet.publicKey,
  configId,
  positionId: 100,
  asset: new PublicKey("NFT_ASSET_ADDRESS"),
  tokenMint,
  collection: new PublicKey("COLLECTION_ADDRESS"),
  updateAuthority: new PublicKey("UPDATE_AUTHORITY"),
});

// Query functions
// Fetch config
const config = await sdk.fetchConfigByAddress(configPda);

// Fetch position
const position = await sdk.fetchPosition(
  wallet.publicKey,
  42, // position ID
  tokenMint
);

// Fetch NFT position
const nftPosition = await sdk.fetchPosition(
  wallet.publicKey,
  100, // position ID
  tokenMint,
  new PublicKey("NFT_ASSET_ADDRESS")
);

// Fetch all user positions
const positions = await sdk.fetchPositionsByOwner(wallet.publicKey);

// Admin functions
// Pause a pool
await sdk.adminPausePoolRpc({
  authority: wallet.publicKey,
  configId,
  poolIndex: 2,
});

// Update pool configuration
await sdk.adminSetPoolConfigRpc({
  authority: wallet.publicKey,
  configId,
  poolIndex: 1,
  poolConfigArgs: {
    yieldRate: 500, // 5%
    maxNftsCap: 1000,
    maxTokensCap: new BN(1000000000),
    isPaused: false,
  },
});
```

