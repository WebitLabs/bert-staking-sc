import { PublicKey, Umi } from "@metaplex-foundation/umi";
import { publicKey } from "@metaplex-foundation/umi/serializers";

export function findBertConfigPda(umi: Umi, authority: PublicKey) {
  return umi.eddsa.findPda(umi.programs.getPublicKey("bertStakingSc"), [
    Buffer.from("config"),
    publicKey().serialize(authority),
  ]);
}
