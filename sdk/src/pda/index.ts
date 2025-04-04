import { PublicKey } from "@solana/web3.js";

/**
 * Helper class for deriving PDAs for the Bert Staking program
 */
export class BertStakingPda {
  constructor(public programId: PublicKey) {}

  /**
   * Find the Config PDA for a given authority
   * @param authority The authority public key
   * @returns The Config PDA and bump
   */
  findConfigPda(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config"), authority.toBuffer()],
      this.programId
    );
  }

  /**
   * Find the Program Authority PDA
   * @returns The Program Authority PDA and bump
   */
  findAuthorityVaultPda(
    mint: PublicKey,
    owner: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("authority_vault"), owner.toBuffer(), mint.toBuffer()],
      this.programId
    );
  }

  /**
   * Find the Position PDA for a given owner and mint
   * @param owner The owner public key
   * @param mint The NFT or token mint
   * @returns The Position PDA and bump
   */
  findPositionPda(owner: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("position"), owner.toBuffer(), mint.toBuffer()],
      this.programId
    );
  }
}
