import { PublicKey, Umi } from "@metaplex-foundation/umi";
import { u64 } from "@metaplex-foundation/umi/serializers";

export function findBertConfigPda(umi: Umi, id: number = 0) {
  return umi.eddsa.findPda(umi.programs.getPublicKey("bertStakingSc"), [
    Buffer.from("config"),
    u64().serialize(BigInt(id)),
  ]);
}
