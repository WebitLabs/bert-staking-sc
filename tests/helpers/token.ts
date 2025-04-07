import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  ACCOUNT_SIZE,
  AccountLayout,
  getAssociatedTokenAddressSync,
  MintLayout,
} from "@solana/spl-token";
import { createAndProcessTransaction } from "./bankrun";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { BanksClient } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { getCollectionV1AccountDataSerializer } from "@metaplex-foundation/mpl-core/dist/src/generated/types/collectionV1AccountData";
import {
  AssetV1AccountData,
  getAssetV1AccountDataSerializer,
} from "@metaplex-foundation/mpl-core/dist/src/hooked";

export async function createAta(
  client: BanksClient,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
) {
  // Create associated token account for the user
  let userTokenAccount = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const createAtaIx = createAssociatedTokenAccountInstruction(
    owner,
    userTokenAccount,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  await createAndProcessTransaction(client, payer, createAtaIx);

  return userTokenAccount;
}

export function createAtaForMint(
  provider: BankrunProvider,
  owner: PublicKey,
  mint: PublicKey,
  amount = BigInt(1_000_000_000_000),
) {
  const address = getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    TOKEN_PROGRAM_ID,
  );

  const tokenAccData = Buffer.alloc(ACCOUNT_SIZE);

  AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      delegatedAmount: BigInt(0),
      state: 1,
      isNativeOption: 0,
      isNative: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    tokenAccData,
  );

  const accountInfo = {
    address,
    info: {
      data: tokenAccData,
      executable: false,
      lamports: LAMPORTS_PER_SOL,
      owner: TOKEN_PROGRAM_ID,
    },
  };

  provider.context.setAccount(accountInfo.address, accountInfo.info);
}

export async function getTokenBalance(
  client: BanksClient,
  tokenAccountAddress: PublicKey,
) {
  const accountInfo = await client.getAccount(tokenAccountAddress);

  if (accountInfo === null) {
    return 0;
  }

  const tokenAccount = AccountLayout.decode(accountInfo.data);
  return parseInt(tokenAccount.amount.toString());
}

export async function getMintDecimals(client: BanksClient, mint: PublicKey) {
  const accountInfo = await client.getAccount(mint);

  if (accountInfo === null) {
    return 0;
  }

  const tokenAccount = MintLayout.decode(accountInfo.data);
  return parseInt(tokenAccount.decimals.toString());
}

// export function createCollectionV1InContext(collection: PublicKey) {
//   const serializer = getCollectionV1AccountDataSerializer();
// }

export async function getMplCoreAsset(client: BanksClient, pubkey: PublicKey) {
  const accountInfo = await client.getAccount(pubkey);

  const serializer = getAssetV1AccountDataSerializer();

  const [assetAccountData] = serializer.deserialize(accountInfo.data);

  return assetAccountData;
}

export async function getMplCoreCollection(
  client: BanksClient,
  pubkey: PublicKey,
) {
  const accountInfo = await client.getAccount(pubkey);

  const serializer = getCollectionV1AccountDataSerializer();

  const [assetAccountData] = serializer.deserialize(accountInfo.data);

  return assetAccountData;
}
