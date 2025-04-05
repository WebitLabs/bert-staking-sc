import "dotenv/config";
import { Command } from "commander";
import { getWallet } from "../utils/connection";
import ora from "ora";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  generateSigner,
  publicKey,
  signerIdentity,
  TransactionBuilderSendAndConfirmOptions,
} from "@metaplex-foundation/umi";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createCollectionV1,
  createV1,
  mplCore,
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
        const spinner = ora("Creating new token mint...").start();

        // const connection = getConnection();
        const wallet = getWallet();
        const payer = wallet.payer;

        const umi = createUmi(RPC);
        umi.use(mplCore());

        const userWallet = umi.eddsa.createKeypairFromSecretKey(
          new Uint8Array(payer.secretKey),
        );
        const userWalletSigner = createSignerFromKeypair(umi, userWallet);

        umi.use(signerIdentity(userWalletSigner));
        umi.use(mplTokenMetadata());
        umi.use(irysUploader());

        const txConfig: TransactionBuilderSendAndConfirmOptions = {
          send: { skipPreflight: true },
          confirm: { commitment: "confirmed" },
        };

        // Create the NFT + Collection (if required)
        try {
          let collectionPubkey = options.collection
            ? publicKey(options.collection)
            : publicKey("Sysvar1111111111111111111111111111111111111");
          if (!options.collection) {
            // Create a collection
            const collection = generateSigner(umi);
            collectionPubkey = collection.publicKey;
            await createCollectionV1(umi, {
              name: `${options.name} Collection`,
              uri: "https://example.com/collection.json",
              collection: collection,
            }).sendAndConfirm(umi, txConfig);
          }

          const n = Math.random() % 100;
          const asset = generateSigner(umi);
          await createV1(umi, {
            name: `${options.name} #${n}`,
            uri: "https://your.domain.com/asset-id.json",
            asset: asset,
            collection: collectionPubkey,
            authority: userWalletSigner,
          }).sendAndConfirm(umi, txConfig);

          spinner.succeed(`NFT created: ${asset.publicKey.toString()}`);

          // Token information summary
          console.log("\nMPL Core NFT Created Successfully:");
          console.log(`- Mint Address: ${asset.publicKey.toString()}`);
          console.log(`- Name: ${options.name}`);
          console.log(`- Authority: ${payer.publicKey.toString()}`);
        } catch (error) {
          spinner.fail(`Failed to MPL Core NFT mint: ${error}`);
        }
      } catch (error) {
        ora().fail(`Failed to create token: ${error}`);
      }
    });
}
