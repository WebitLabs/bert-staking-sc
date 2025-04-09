import {
  createCollectionV1,
  createV1,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import {
  getAssetV1AccountDataSerializer,
  getCollectionV1AccountDataSerializer,
} from "@metaplex-foundation/mpl-core/dist/src/hooked";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
  toWeb3JsInstruction,
  toWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";
import { clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { BanksClient } from "solana-bankrun";
import { createAndProcessTransaction } from "./bankrun";

export async function getMplCoreAsset(client: BanksClient, pubkey: PublicKey) {
  const accountInfo = await client.getAccount(pubkey);
  const serializer = getAssetV1AccountDataSerializer();
  const [assetAccountData] = serializer.deserialize(accountInfo.data);

  return assetAccountData;
}

export async function getMplCoreCollection(
  client: BanksClient,
  pubkey: PublicKey
) {
  const accountInfo = await client.getAccount(pubkey);

  const serializer = getCollectionV1AccountDataSerializer();

  const [assetAccountData] = serializer.deserialize(accountInfo.data);

  return assetAccountData;
}

export async function createCollectionAndMintAsset(
  authority: Keypair,
  client: BanksClient,
  name: string
) {
  const umi = createUmi(clusterApiUrl("devnet"));
  const signerWallet = createSignerFromKeypair(
    umi,
    fromWeb3JsKeypair(authority)
  );

  umi.use(signerIdentity(signerWallet));
  umi.use(mplCore());
  umi.use(mplTokenMetadata());

  // Create the NFT + Collection (if required)
  try {
    // Create a collection
    const collection = generateSigner(umi);
    let ixs = createCollectionV1(umi, {
      name: `${name} Collection`,
      uri: "https://example.com/collection.json",
      collection: collection,
    }).getInstructions();

    let web3ixs = ixs.map((ix) => toWeb3JsInstruction(ix));

    await createAndProcessTransaction(client, authority, web3ixs, [
      toWeb3JsKeypair(collection),
    ]);

    const n = Math.random() % 100;
    const asset = generateSigner(umi);
    let createIxs = createV1(umi, {
      name: `${name} #${n}`,
      uri: "https://your.domain.com/asset-id.json",
      asset: asset,
      collection: collection.publicKey,
      authority: signerWallet,
      owner: fromWeb3JsPublicKey(authority.publicKey),
    }).getInstructions();

    let web3Createixs = createIxs.map((ix) => toWeb3JsInstruction(ix));

    await createAndProcessTransaction(client, authority, web3Createixs, [
      toWeb3JsKeypair(asset),
    ]);

    return { collection, asset };
  } catch (err) {
    console.log("[createcollection] failed");
    throw err;
  }
}
