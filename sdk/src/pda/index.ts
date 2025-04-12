import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

/**
 * Helper class for deriving PDAs for the Bert Staking program
 */
export class BertStakingPda {
  constructor(public programId: PublicKey) {}

  /**
   * Find the Config PDA for a given authority and ID
   * @param authority The authority public key
   * @param id Optional ID for the config (defaults to 0)
   * @returns The Config PDA and bump
   */
  findConfigPda(authority: PublicKey, id: number = 0): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("config"),
        authority.toBuffer(),
        new BN(id).toArrayLike(Buffer, "le", 8),
      ],
      this.programId
    );
  }

  /**
   * Find the User Account PDA
   */
  findUserAccountPda(owner: PublicKey, config: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("user"), owner.toBuffer(), config.toBuffer()],
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
   * Find the Position PDA for a given owner, mint, and ID
   * @param owner The owner public key
   * @param mint The token mint public key
   * @param id Optional ID for the position (defaults to 0)
   * @returns The Position PDA and bump
   */
  findPositionPda(
    owner: PublicKey,
    mint: PublicKey,
    id: number = 0
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        owner.toBuffer(),
        mint.toBuffer(),
        new BN(id).toArrayLike(Buffer, "le", 8),
      ],
      this.programId
    );
  }

  /**
   * Find the NFT Position PDA for a given owner, mint, and ID
   */
  findNftPositionPda(
    owner: PublicKey,
    mint: PublicKey,
    asset: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        owner.toBuffer(),
        mint.toBuffer(),
        asset.toBuffer(),
      ],
      this.programId
    );
  }
}
