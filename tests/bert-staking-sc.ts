import { expect } from "chai";
import { prelude } from "./helpers/prelude";
import { Keypair } from "@solana/web3.js";
import { createAndProcessTransaction } from "./helpers/bankrun";
import { BertStakingSDK } from "../sdk/src";
import { BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";

describe("bert-staking-sc", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;
  let provider: BankrunProvider;

  let sdk: BertStakingSDK;

  before("before", async () => {
    const {
      context: _context,
      payer: _payer,
      client: _client,
      provider: _provider,
    } = await prelude();

    context = _context;
    payer = _payer;
    client = _client;
    provider = _provider;

    sdk = new BertStakingSDK(provider);
  });

  it("Initializes the Bert staking program", async () => {
    // Test parameters for initialization
    const lockTime = 7; // 7 days lock period
    const yieldRate = 500; // 5% in basis points
    const maxCap = 1_000_000_000; // 1 billion tokens
    const nftValueInTokens = 100_000; // 100k tokens per NFT
    const nftsLimitPerUser = 5; // 5 NFTs max per user

    let authority: Keypair;

    // Set authority to payer
    authority = payer;
    console.log("Authority:", authority.publicKey.toString());

    const [configPda] = sdk.pda.findConfigPda(authority.publicKey);
    console.log("Config PDA:", configPda.toString());

    // Create the initialize instruction
    const initializeIx = await sdk.initialize({
      authority: authority.publicKey,
      lockTime,
      yieldRate,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });

    try {
      // Create and process the transaction
      await createAndProcessTransaction(client, authority, initializeIx);

      // Fetch the config account to verify initialization
      const configAccount = await sdk.fetchConfigByAddress(configPda);

      // Assert that all config values are set correctly
      expect(configAccount.authority).to.deep.equal(authority.publicKey);
      expect(configAccount.lockTime.toString()).to.equal(lockTime.toString());
      expect(configAccount.yieldRate.toString()).to.equal(yieldRate.toString());
      expect(configAccount.maxCap.toString()).to.equal(maxCap.toString());
      expect(configAccount.nftValueInTokens.toString()).to.equal(
        nftValueInTokens.toString()
      );
      expect(configAccount.nftsLimitPerUser).to.equal(nftsLimitPerUser);
      expect(configAccount.totalStakedAmount.toString()).to.equal("0");

      console.log(
        "Config initialized successfully with the following parameters:"
      );
      console.log("Lock Time (days):", configAccount.lockTime.toString());
      console.log("Yield Rate (bps):", configAccount.yieldRate.toString());
      console.log("Max Cap:", configAccount.maxCap.toString());
      console.log(
        "NFT Value in Tokens:",
        configAccount.nftValueInTokens.toString()
      );
      console.log("NFTs Limit Per User:", configAccount.nftsLimitPerUser);
    } catch (err) {
      console.error("Failed to process initialize tx with err:", err);
      expect.fail("Failed to process initialize tx");
    }
  });
});

