import "dotenv/config";
import { Command } from "commander";
import { getWallet } from "../utils/connection";
import ora from "ora";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
  TransactionBuilderSendAndConfirmOptions,
} from "@metaplex-foundation/umi";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  mplCore,
  safeFetchAssetV1,
  transferV1,
} from "@metaplex-foundation/mpl-core";

const RPC = process.env.ENDPOINT || "https://api.devnet.solana.com";

/**
 * Create a new token mint with metadata
 */
export function transferCoreNftCommand(program: Command): void {
  program
    .command("transfer-core-nft")
    .description("Transfer Metaplex Core NFT")
    .option("-a, --asset <string>", "NFT asset")
    .option("-d, --dest <string>", "NFT asset destination wallet")

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

        const assetPubkey = publicKey(options.asset);
        const assetAccount = await safeFetchAssetV1(umi, assetPubkey);

        if (!assetAccount) {
          throw new Error("Failed to fetch asset");
        }

        await transferV1(umi, {
          asset: assetPubkey,
          newOwner: publicKey!(options.dest),
          collection: assetAccount.updateAuthority.address,
        }).sendAndConfirm(umi, txConfig);

        console.log("✅ done!");
      } catch (error) {
        ora().fail(`Failed to create MPL Conre NFT assset: ${error}`);
      }
    });
}
