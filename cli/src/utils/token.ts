import {
  createAndMint,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createGenericFile,
  generateSigner,
  KeypairSigner,
  percentAmount,
  publicKey,
  PublicKey,
  Umi,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { readFile } from "fs/promises";

export function transformArweaveToIrys(url: string): string {
  if (!url.startsWith("https://arweave.net/")) {
    // Return the original URL if it's not an Arweave URL
    return url;
  }

  const id = url.replace("https://arweave.net/", "");

  // Return the transformed URL
  return `https://devnet.irys.xyz/${id}`;
}

async function uploadImage(umi: Umi, imgFile: string) {
  try {
    const img = await readFile(imgFile);

    const imgConverted = createGenericFile(new Uint8Array(img), "image/png");

    const [myUri] = await umi.uploader.upload([imgConverted]);

    return transformArweaveToIrys(myUri);
  } catch (err) {
    console.error("[uploadImage] Failed with error:", err);
  }
}

async function uploadMetadata(
  umi: Umi,
  imgUri: string,
  name: string,
  symbol: string,
  desciption: string
) {
  try {
    const metadata = {
      name,
      symbol,
      desciption,
      image: imgUri,
      properties: {
        files: [{ type: "image/png", uri: imgUri }],
      },
    };

    const metadataUri = await umi.uploader.uploadJson(metadata);

    // Transform the URI if it's in Arweave format
    return transformArweaveToIrys(metadataUri);
  } catch (error) {
    console.error("[uploadMetadata] Failed with:", error);
  }
}

export async function createAndMintToken(
  umi: Umi,
  mint: KeypairSigner,
  metadata: { name: string; symbol: string; description: string },
  imgFile: string,
  owner: string,
  decimals: number,
  amount: number
) {
  try {
    const imgUri = await uploadImage(umi, imgFile);
    if (!imgUri) {
      throw Error("Failed to upload image");
    }

    const metadataUri = await uploadMetadata(
      umi,
      imgUri,
      metadata.name,
      metadata.symbol,
      metadata.description
    );
    if (!metadataUri) {
      throw Error("Failed to upload metadata");
    }

    const result = await createAndMint(umi, {
      mint,
      authority: umi.identity,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadataUri, // Transform URI to Irys format if needed
      sellerFeeBasisPoints: percentAmount(0),
      decimals,
      amount: amount * 10 ** decimals,
      tokenOwner: publicKey(owner),
      tokenStandard: TokenStandard.Fungible,
    }).sendAndConfirm(umi);

    console.log("Successfully minted 1 million tokens (", mint.publicKey, ")");
    console.log("Tx sig: ", base58.deserialize(result.signature));
  } catch (error) {
    console.error("Error minting tokens:", error);
    throw error;
  }
}
