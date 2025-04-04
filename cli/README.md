# BERT Staking CLI

A command-line interface for managing the BERT Staking Protocol.

## Installation

```sh
# Install dependencies
npm install

# Build the CLI
npm run build

# Link the CLI globally (optional)
npm link
```

## Usage

```sh
# Show help
bert-staking --help

# Initialize staking program
bert-staking initialize --mint <TOKEN_MINT> --collection <COLLECTION_MINT> --lock-period 7

# Initialize position
bert-staking init-position --token-mint <TOKEN_MINT>

# Stake tokens
bert-staking stake-token --token-mint <TOKEN_MINT> --amount 100 --lock-period 7

# Fetch program configuration
bert-staking fetch-config --authority <AUTHORITY>

# Fetch position
bert-staking fetch-position --mint <TOKEN_MINT>

# Fetch all positions for a user
bert-staking fetch-position --all
```

## Global Options

These options apply to all commands:

```
--network <network>    Network to connect to (mainnet, devnet, testnet, localhost)
--url <rpc-url>        Custom RPC URL (overrides --network)
--keypair <path>       Path to keypair file (defaults to ~/.config/solana/id.json)
--program-id <pubkey>  Custom program ID
```

## Commands

### Initialize Program

```sh
bert-staking initialize [options]
```

Options:
- `-m, --mint <pubkey>` - Token mint address
- `-c, --collection <pubkey>` - NFT collection address
- `-l, --lock-period <period>` - Lock period (1, 3, 7, or 30 days)
- `-y, --yield-rate <bps>` - Yield rate in basis points (100 = 1%)
- `-cap, --max-cap <amount>` - Maximum staking capacity in tokens
- `-nv, --nft-value <amount>` - NFT value in tokens
- `-nl, --nft-limit <number>` - NFT limit per user

### Initialize Position

```sh
bert-staking init-position [options]
```

Options:
- `-a, --authority <pubkey>` - Authority public key (if different from wallet)
- `-t, --token-mint <pubkey>` - Token mint address
- `-p, --position-type <type>` - Position type (token or nft)
- `-n, --nft-mint <pubkey>` - NFT mint address (required for NFT positions)

### Stake Tokens

```sh
bert-staking stake-token [options]
```

Options:
- `-a, --authority <pubkey>` - Authority public key (if different from wallet)
- `-t, --token-mint <pubkey>` - Token mint address
- `-a, --amount <number>` - Amount of tokens to stake
- `-l, --lock-period <period>` - Lock period (1, 3, 7, or 30 days)

### Fetch Config

```sh
bert-staking fetch-config [options]
```

Options:
- `-a, --authority <pubkey>` - Authority public key
- `-c, --config <pubkey>` - Config PDA (alternative to authority)

### Fetch Position

```sh
bert-staking fetch-position [options]
```

Options:
- `-o, --owner <pubkey>` - Position owner (defaults to wallet)
- `-m, --mint <pubkey>` - Token/NFT mint address
- `-p, --position <pubkey>` - Position PDA address
- `--all` - Fetch all positions for the owner