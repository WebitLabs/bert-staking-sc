import { Command } from "commander";
import { getConnection, getWallet } from "../utils/connection";
import ora from "ora";
import { createAndMintToken } from "../utils/token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";

const RPC =
  "https://devnet.helius-rpc.com/?api-key=702ddf04-244d-42d9-b282-aec1d8783deb";

/**
 * Create a new token mint with metadata
 */
export function createTokenCommand(program: Command): void {
  program
    .command("create-token")
    .description("Create a new fungible token mint with metadata")
    .option("-n, --name <string>", "Token name", "BERT Token")
    .option("-s, --symbol <string>", "Token symbol", "BERT")
    .option("-d, --decimals <number>", "Token decimals", "6")
    .option("-i, --image <string>", "Token image", "./token.png")
    .option("-o, --owner <string>", "New token owner")
    .option(
      "-a, --amount <number>",
      "Initial token amount to mint",
      "1000000000000"
    )
    .action(async (options) => {
      try {
        const spinner = ora("Creating new token mint...").start();

        const connection = getConnection();
        const wallet = getWallet();
        const payer = wallet.payer;
        const decimals = parseInt(options.decimals);
        const amount = parseInt(options.amount);

        const umi = createUmi(RPC);

        const userWallet = umi.eddsa.createKeypairFromSecretKey(
          new Uint8Array(payer.secretKey)
        );
        const userWalletSigner = createSignerFromKeypair(umi, userWallet);

        umi.use(signerIdentity(userWalletSigner));
        umi.use(mplTokenMetadata());

        // Generate a new keypair for the mint
        const mint = generateSigner(umi);
        spinner.text = `Creating token mint: ${mint.publicKey.toString()}`;

        // Create the token mint
        try {
          const metadata = {
            name: options.name,
            symbol: options.symbol,
            description: "",
          };

          await createAndMintToken(
            umi,
            mint,
            metadata,
            options.image,
            options.owner,
            decimals,
            amount
          );

          spinner.succeed(`Token mint created: ${mint.publicKey.toString()}`);

          // Token information summary
          console.log("\nToken Created Successfully:");
          console.log(`- Mint Address: ${mint.publicKey.toString()}`);
          console.log(`- Decimals: ${decimals}`);
          console.log(`- Name: ${options.name}`);
          console.log(`- Symbol: ${options.symbol}`);
          console.log(`- Authority: ${payer.publicKey.toString()}`);
          console.log(`- Freeze Authority: ${payer.publicKey.toString()}`);
        } catch (error) {
          spinner.fail(`Failed to create token mint: ${error}`);
        }
      } catch (error) {
        ora().fail(`Failed to create token: ${error}`);
      }
    });
}

