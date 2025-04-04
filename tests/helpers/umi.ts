import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { Umi, keypairIdentity } from "@metaplex-foundation/umi";
import { BankrunProvider } from "anchor-bankrun";
import { AnchorProvider } from "@coral-xyz/anchor";

/**
 * Creates a UMI instance configured to work with Bankrun
 */
export const initializeUmi = async (
  fakeProvider: AnchorProvider
): Promise<Umi> => {
  try {
    const umi = createUmi(fakeProvider.connection.rpcEndpoint);

    // Get the payer from the provider
    // umi.use(
    //   keypairIdentity(
    //     umi.eddsa.createKeypairFromSecretKey(provider.wallet.payer.secretKey)
    //   )
    // );

    return umi;
  } catch (err) {
    console.error("err:", err);
  }
};
