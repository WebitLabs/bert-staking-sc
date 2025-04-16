import "dotenv/config";
import { Command } from "commander";
import { getWallet } from "../utils/connection";
import ora from "ora";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  createSignerFromKeypair,
  generateSigner,
  KeypairSigner,
  publicKey,
  signerIdentity,
  TransactionBuilderSendAndConfirmOptions,
} from "@metaplex-foundation/umi";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createCollectionV1,
  createV1,
  getAssetV1GpaBuilder,
  mplCore,
  Key,
  updateAuthority,
} from "@metaplex-foundation/mpl-core";

const RPC = process.env.ENDPOINT || "https://api.devnet.solana.com";

/**
 * Create a new token mint with metadata
 */
export function createCoreNftCommand(program: Command): void {
  program
    .command("create-core-nft")
    .description("Create a new fungible Metaplex Core NFT")
    .option("-n, --name <string>", "Token name", "B NFT")
    .option("-c, --collection <string>", "Collection")
    .option("-i, --image <string>", "NFT image", "./nft.png")
    .option("-o, --owner <string>", "New token owner")

    .action(async (options) => {
      try {
        //const spinner = ora("Creating new token mint...").start();

        // const connection = getConnection();
        const wallet = getWallet();
        const payer = wallet.payer;

        const umi = createUmi(RPC);
        umi.use(mplCore());

        const userWallet = umi.eddsa.createKeypairFromSecretKey(
          new Uint8Array(payer.secretKey)
        );
        const userWalletSigner = createSignerFromKeypair(umi, userWallet);

        umi.use(signerIdentity(userWalletSigner));
        umi.use(mplTokenMetadata());
        umi.use(irysUploader());

        const txConfig: TransactionBuilderSendAndConfirmOptions = {
          send: { skipPreflight: true },
          confirm: { commitment: "confirmed" },
        };

        // 4. Fetch assets by owner
        const assetsByOwner = await getAssetV1GpaBuilder(umi)
          .whereField("key", Key.AssetV1)
          .whereField("owner", userWalletSigner.publicKey)
          .getDeserialized();

        console.log("assets by owner:");
        assetsByOwner.map((a) => console.log(a));

        // Create the NFT + Collection (if required)
        try {
          // Create a collection
          const collection = generateSigner(umi);

          console.log("Creating Collection:", collection.publicKey.toString());
          console.log(
            "Coolection Update Authority:",
            userWalletSigner.publicKey.toString()
          );

          await createCollectionV1(umi, {
            name: `${options.name} Collection`,
            uri: "https://example.com/collection.json",
            collection: collection,
            updateAuthority: userWalletSigner.publicKey,
          }).sendAndConfirm(umi, txConfig);

          console.log("✅ 1");

          let asset: KeypairSigner;
          await Promise.all(
            Array(50)
              .fill(1)
              .map(async () => {
                console.log("✅ 2");

                const random = Math.floor(Math.random() * 100);
                asset = generateSigner(umi);

                console.log("✅ 3");

                console.log("minting with asset: ", asset.publicKey.toString());
                console.log(
                  "minting with collection: ",
                  collection.publicKey.toString()
                );
                console.log(
                  "minting with payer: ",
                  userWalletSigner.publicKey.toString()
                );

                console.log("✅ 4");

                const result = await createV1(umi, {
                  name: `${options.name} #${random}`,
                  uri: "https://your.domain.com/asset-id.json",
                  asset: asset,
                  collection: collection.publicKey,
                  authority: userWalletSigner,
                  payer: userWalletSigner,
                }).sendAndConfirm(umi, txConfig);

                console.log("✅ 6");

                if (result.result.value.err) {
                  console.log(
                    "❌ to mint asset with er",
                    result.result.value.err
                  );
                  throw result.result.value.err;
                }

                console.log(
                  "done minting with result:",
                  base58.deserialize(result.signature)[0]
                );
              })
          );

          //spinner.succeed(`NFT created: ${asset!.publicKey.toString()}`);

          // Token information summary
          console.log("\nMPL Core NFT Created Successfully:");
          console.log(`- Mint Address: ${asset!.publicKey.toString()}`);
          //console.log(`- Name: ${options.name} #${random}`);
          console.log(`- Authority: ${payer.publicKey.toString()}`);
        } catch (error) {
          console.error("Failed to MPL Core NFT asset:", error);
          // spinner.fail(`Failed to MPL Core NFT asset: ${error}`);
        }
      } catch (error) {
        ora().fail(`Failed to create MPL Conre NFT assset: ${error}`);
      }
    });
}
