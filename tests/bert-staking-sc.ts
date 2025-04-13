import { config, expect } from "chai";
import { prelude } from "./helpers/prelude";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  advanceUnixTimeStamp,
  createAndProcessTransaction,
  getAddedAccountInfo,
} from "./helpers/bankrun";
import {
  BertStakingSDK,
  ConfigIdl,
  Position,
  PositionIdl,
  PositionType,
} from "../sdk/src";
import { AddedProgram, BanksClient, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MPL_CORE_ADDRESS, USDC_MINT_ADDRESS } from "./helpers/constants";
import {
  createAtaForMint,
  createAtaForMintWithAddress,
  getMintDecimals,
  getTokenBalance,
} from "./helpers/token";
import { getMplCoreAsset, createCollectionAndMintAsset } from "./helpers/core";
import { KeypairSigner } from "@metaplex-foundation/umi";
import {
  toWeb3JsKeypair,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { PoolConfigParams } from "@bert-staking/sdk/src/utils";

const addedPrograms: AddedProgram[] = [
  { name: "mpl_core", programId: new PublicKey(MPL_CORE_ADDRESS) },
];

const maxNftsCap = 1000;
const maxTokensCap = 1_000_000_000_000_000; // 1 Bilion with 6 decimals

const poolsConfig = [
  {
    lockPeriodDays: 1,
    yieldRate: 300,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
  {
    lockPeriodDays: 3,
    yieldRate: 500,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
  {
    lockPeriodDays: 7,
    yieldRate: 800,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
  {
    lockPeriodDays: 30,
    yieldRate: 1200,
    maxNfts: maxNftsCap,
    maxTokens: maxTokensCap,
  },
];

describe("bert-staking-sc", () => {
  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;
  let provider: BankrunProvider;
  let sdk: BertStakingSDK;

  const tokenMint = new PublicKey(USDC_MINT_ADDRESS);

  // Global IDs for configs and positions
  const configId = 1; // Using 1 instead of 0 to test non-default ID
  const positionId = 42; // Using arbitrary ID for positions
  const nftPositionId = positionId + 100;

  // Test parameters for initialization
  const maxCap = 1_000_000_000; // 1 billion tokens
  const nftValueInTokens = 100_000; // 100k tokens per NFT
  const nftsLimitPerUser = 5; // 5 NFTs max per user

  // Token staking parameters
  let userTokenAccount: PublicKey;

  // let collection = new PublicKey(B_COLLECTION);
  // let asset = new PublicKey(B_545_ASSET);
  let decimals: number;

  let collectionSigner: KeypairSigner;
  let assetSigner: KeypairSigner;

  let tokensInVault: number;

  before("before", async () => {
    const usdcMint = await getAddedAccountInfo(tokenMint);
    // const bCollection = await getAddedAccountInfo(collection);
    // const bAsset = await getAddedAccountInfo(asset);

    const addedAccounts = [usdcMint];

    const {
      context: _context,
      payer: _payer,
      client: _client,
      provider: _provider,
    } = await prelude(addedPrograms, addedAccounts);

    context = _context;
    payer = _payer;
    client = _client;
    provider = _provider;

    sdk = new BertStakingSDK(provider);

    decimals = await getMintDecimals(client, tokenMint);

    const result = await createCollectionAndMintAsset(
      payer,
      client,
      "B_COLLECTION"
    );

    collectionSigner = result.collection;
    assetSigner = result.asset;
  });

  it("Initializes the Bert staking program with custom pool configurations", async () => {
    let authority = payer;
    console.log("Authority:", authority.publicKey.toString());

    const [configPda] = sdk.pda.findConfigPda(authority.publicKey, configId);
    console.log("Config PDA:", configPda.toString());

    // Get vault ATA for the config
    const vaultTA = getAssociatedTokenAddressSync(tokenMint, configPda, true);

    // Initialize the staking program with pool configurations
    const initializeIx = await sdk.initialize({
      authority: authority.publicKey,
      mint: tokenMint,
      collection: toWeb3JsPublicKey(collectionSigner.publicKey),
      id: configId,
      poolsConfig,
      maxCap,
      nftValueInTokens,
      nftsLimitPerUser,
    });

    let configAccount: ConfigIdl;
    try {
      await createAndProcessTransaction(client, authority, [initializeIx]);
      configAccount = await sdk.fetchConfigByAddress(configPda);
    } catch (err) {
      console.error("Failed to process initialize tx with err:", err);
      expect.fail("Failed to process initialize tx");
    }

    // Verify config values
    expect(configAccount.authority).to.deep.equal(authority.publicKey);
    expect(configAccount.mint).to.deep.equal(tokenMint);
    expect(configAccount.id.toNumber()).to.deep.equal(configId);
    expect(configAccount.vault.toString()).to.equal(vaultTA.toString());

    // Verify pool configurations
    expect(configAccount.poolsConfig.length).to.equal(4);

    // Verify yield rates
    expect(configAccount.poolsConfig[0].yieldRate.toNumber()).to.equal(300);
    expect(configAccount.poolsConfig[1].yieldRate.toNumber()).to.equal(500);
    expect(configAccount.poolsConfig[2].yieldRate.toNumber()).to.equal(800);
    expect(configAccount.poolsConfig[3].yieldRate.toNumber()).to.equal(1200);

    // Verify max caps for NFTs and tokens across all pools
    for (let i = 0; i < 4; i++) {
      expect(configAccount.poolsConfig[i].maxNftsCap).to.equal(maxNftsCap);
      expect(configAccount.poolsConfig[i].maxTokensCap.toString()).to.equal(
        maxTokensCap.toString()
      );
    }

    // Verify lock periods are correctly set
    expect(configAccount.poolsConfig[0].lockPeriodDays).to.equal(1);
    expect(configAccount.poolsConfig[1].lockPeriodDays).to.equal(3);
    expect(configAccount.poolsConfig[2].lockPeriodDays).to.equal(7);
    expect(configAccount.poolsConfig[3].lockPeriodDays).to.equal(30);

    // Verify pool stats are initialized correctly
    for (let i = 0; i < 4; i++) {
      expect(configAccount.poolsStats[i].totalNftsStaked).to.equal(0);
      expect(configAccount.poolsStats[i].totalTokensStaked.toString()).to.equal(
        "0"
      );
      expect(configAccount.poolsStats[i].lifetimeNftsStaked).to.equal(0);
      expect(
        configAccount.poolsStats[i].lifetimeTokensStaked.toString()
      ).to.equal("0");
      expect(
        configAccount.poolsStats[i].lifetimeClaimedYield.toString()
      ).to.equal("0");

      // Verify lock periods in stats match the config
      expect(configAccount.poolsStats[i].lockPeriodDays).to.equal(
        configAccount.poolsConfig[i].lockPeriodDays
      );
    }

    // Verify global configuration
    expect(configAccount.maxCap.toString()).to.equal(maxCap.toString());
    expect(configAccount.nftValueInTokens.toString()).to.equal(
      nftValueInTokens.toString()
    );
    expect(configAccount.nftsLimitPerUser).to.equal(nftsLimitPerUser);
    expect(configAccount.totalStakedAmount.toString()).to.equal("0");
    expect(configAccount.totalNftsStaked.toString()).to.equal("0");

    console.log("Config initialized successfully with all pool configurations");
    console.log("Pool Configurations:");
    configAccount.poolsConfig.forEach((pool, index) => {
      console.log(`Pool ${index} (${pool.lockPeriodDays} days):`);
      console.log(`  Yield Rate: ${pool.yieldRate.toNumber() / 100}%`);
      console.log(`  Max NFTs: ${pool.maxNftsCap}`);
      console.log(`  Max Tokens: ${pool.maxTokensCap.toString()}`);
    });

    console.log("Global Configuration:");
    console.log(`Max Cap: ${configAccount.maxCap.toString()}`);
    console.log(
      `NFT Value in Tokens: ${configAccount.nftValueInTokens.toString()}`
    );
    console.log(`NFTs Limit Per User: ${configAccount.nftsLimitPerUser}`);
  });

  // it("Creates token mint and accounts for testing", async () => {
  //   try {
  //     const owner = payer.publicKey;
  //     const mint = tokenMint;
  //
  //     const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
  //
  //     // Create the ATAs with some tokens for the user and the vault
  //     const mintAmount = 1_000 * 10 ** decimals;
  //     tokensInVault = mintAmount;
  //     createAtaForMint(provider, owner, mint, BigInt(mintAmount));
  //     createAtaForMint(provider, configPda, mint, BigInt(mintAmount));
  //
  //     userTokenAccount = getAssociatedTokenAddressSync(mint, owner, true);
  //
  //     console.log(
  //       `User has ${await getTokenBalance(client, userTokenAccount)} USDC`
  //     );
  //   } catch (err) {
  //     console.error("Failed to set up token mint and accounts:", err);
  //     expect.fail("Token setup failed");
  //   }
  // });
  //
  // it("Initializes a position and then stakes tokens successfully", async () => {
  //   const decimals = await getMintDecimals(client, tokenMint);
  //
  //   const stakeAmount = 500 * 10 ** decimals; // 500 tokens
  //   const mintAmount = 1_000 * 10 ** decimals; // 1_000 previously minted tokens
  //
  //   // Use the configured configId
  //   const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
  //
  //   // We'll use the 7-day lock period which has an 8% yield rate
  //   const lockPeriodYieldIndex = 2;
  //   const [positionPda] = sdk.pda.findPositionPda(
  //     payer.publicKey,
  //     tokenMint,
  //     positionId
  //   );
  //
  //   // NOTE: You no longer need to init position.
  //
  //   // Verify the position was created with correct initial values
  //   let position = await sdk.fetchPosition(
  //     payer.publicKey,
  //     positionId,
  //     tokenMint
  //   );
  //
  //   console.log("position:", position);
  //
  //   expect(position).to.not.be.null;
  //   expect(position.owner.toString()).to.equal(payer.publicKey.toString());
  //   expect(position.status).to.deep.equal({ unclaimed: {} }); // Unclaimed
  //   expect(position.lockPeriodYieldIndex).to.equal(lockPeriodYieldIndex);
  //   console.log("Initial position created with status:", position.status);
  //   console.log("Lock period yield index:", position.lockPeriodYieldIndex);
  //
  //   try {
  //     // Step 2: Now stake tokens to the initialized position
  //     console.log("Staking tokens to the initialized position...");
  //     const stakeTokenIx = await sdk.stakeToken({
  //       authority: payer.publicKey,
  //       owner: payer.publicKey,
  //       tokenMint,
  //       configId,
  //       positionId,
  //       amount: stakeAmount,
  //       tokenAccount: userTokenAccount,
  //     });
  //
  //     // Process the stake token transaction
  //     await createAndProcessTransaction(client, payer, [stakeTokenIx]);
  //     console.log("Tokens staked successfully");
  //   } catch (err) {
  //     console.error("Failed to stake tokens:", err);
  //     expect.fail("Staking failed");
  //   }
  //
  //   // Verify staking results
  //
  //   // 1. Check user's token balance decreased
  //   const userTokenAccountBalance = await getTokenBalance(
  //     client,
  //     userTokenAccount
  //   );
  //
  //   const expectedRemainingBalance = mintAmount - stakeAmount;
  //   expect(userTokenAccountBalance).to.equal(expectedRemainingBalance);
  //   console.log("User token balance after staking:", userTokenAccountBalance);
  //
  //   const vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);
  //
  //   // 2. Check program's token balance increased
  //   const vaultBalance = await getTokenBalance(client, vaultAta);
  //
  //   expect(vaultBalance).to.equal(stakeAmount + tokensInVault);
  //   console.log("Program token balance after staking:", vaultBalance);
  //
  //   // 3. Check position account was updated correctly after staking
  //   position = await sdk.fetchPosition(payer.publicKey, positionId, tokenMint);
  //   expect(position).to.not.be.null;
  //   expect(position.owner.toString()).to.equal(payer.publicKey.toString());
  //   expect(position.amount.toNumber()).to.equal(stakeAmount);
  //   expect(position.positionType).to.deep.equal({ token: {} }); // Token = 1
  //   expect(position.status).to.deep.equal({ unclaimed: {} }); // Unclaimed = 0
  //   expect(position.lockPeriodYieldIndex).to.equal(lockPeriodYieldIndex);
  //
  //   console.log("Position updated successfully after staking:");
  //   console.log("- Owner:", position.owner.toString());
  //   console.log("- Amount:", position.amount.toString());
  //   console.log("- Lock Period Yield Index:", position.lockPeriodYieldIndex);
  //   console.log(
  //     "- Deposit time:",
  //     new Date(position.depositTime.toNumber() * 1000).toISOString()
  //   );
  //   console.log(
  //     "- Unlock time:",
  //     new Date(position.unlockTime.toNumber() * 1000).toISOString()
  //   );
  //
  //   // Check unlock time is increased by 7 * 24 * 60 * 60 = 604800
  //   const unlockTime = position.unlockTime.toNumber();
  //   const depositTime = position.depositTime.toNumber();
  //   expect(unlockTime - depositTime).to.equal(604800);
  //
  //   // 4. Check config total staked amount increased
  //   const configAccount = await sdk.fetchConfigByAddress(configPda);
  //
  //   expect(configAccount.totalStakedAmount.toNumber()).to.equal(stakeAmount);
  //   console.log(
  //     "Total staked amount:",
  //     configAccount.totalStakedAmount.toString()
  //   );
  // });
  //
  // it("Claims tokens after lock period", async () => {
  //   let configPda: PublicKey;
  //   let configAccount: Config;
  //   let positionPda: PublicKey;
  //   let position: PositionIdl;
  //   let userBalanceBefore: number;
  //   let vaultBalanceBefore: number;
  //   let vaultAta: PublicKey;
  //
  //   try {
  //     // First, let's fetch the token position to confirm it exists and has correct data
  //     [positionPda] = sdk.pda.findPositionPda(
  //       payer.publicKey,
  //       tokenMint,
  //       positionId
  //     );
  //
  //     position = await sdk.fetchPosition(
  //       payer.publicKey,
  //       positionId,
  //       tokenMint
  //     );
  //
  //     console.log("Position before claiming:", {
  //       owner: position.owner.toString(),
  //       amount: position.amount.toString(),
  //       positionType: position.positionType,
  //       status: position.status,
  //       lockPeriodYieldIndex: position.lockPeriodYieldIndex,
  //       depositTime: new Date(
  //         position.depositTime.toNumber() * 1000
  //       ).toISOString(),
  //       unlockTime: new Date(
  //         position.unlockTime.toNumber() * 1000
  //       ).toISOString(),
  //     });
  //
  //     // Warp to the future when the position is unlocked
  //     const unlockTime = position.unlockTime.toNumber();
  //     const currentTime = Math.floor(Date.now() / 1000);
  //
  //     // Calculate how many seconds we need to warp
  //     const secondsToWarp = unlockTime - currentTime + 60; // Add a buffer
  //
  //     // Warp using the bankrun context
  //     advanceUnixTimeStamp(provider, BigInt(secondsToWarp));
  //
  //     console.log(`Warped ${secondsToWarp} seconds into the future`);
  //
  //     // Get config for vault and collection information
  //     [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
  //     configAccount = await sdk.fetchConfigByAddress(configPda);
  //     console.log("Config found:", configPda.toString());
  //
  //     // Get the vault token account
  //     vaultAta = getAssociatedTokenAddressSync(tokenMint, configPda, true);
  //     console.log("Vault ATA:", vaultAta.toString());
  //
  //     // Record balances before claiming
  //     vaultBalanceBefore = await getTokenBalance(client, vaultAta);
  //     userBalanceBefore = await getTokenBalance(client, userTokenAccount);
  //     console.log("Vault balance before:", vaultBalanceBefore);
  //     console.log("User balance before:", userBalanceBefore);
  //
  //     // Create and send the claim position instruction
  //     const claimPositionIx = await sdk.claimTokenPosition({
  //       authority: payer.publicKey, // The authority who initialized the config
  //       owner: payer.publicKey, // The owner of the position
  //       positionPda, // The position PDA to claim
  //       tokenMint, // The token mint (USDC in this case)
  //       tokenAccount: userTokenAccount, // User's token account to receive tokens
  //       vault: vaultAta, // Program vault for tokens
  //       collection: configAccount.collection, // NFT collection (required by instruction)
  //       configId, // Pass the config ID
  //     });
  //
  //     console.log("Claim position instruction created, sending transaction...");
  //     await createAndProcessTransaction(client, payer, [claimPositionIx]);
  //     console.log("Transaction processed successfully");
  //   } catch (err) {
  //     console.error("Failed to claim tokens:", err);
  //     expect.fail(`Token claiming failed: ${err}`);
  //   }
  //
  //   // Verify the results of claiming
  //
  //   // 1. Check user's token balance increased with yield
  //   const userTokenBalance = await getTokenBalance(client, userTokenAccount);
  //
  //   // Get the yield rate from the lock period yield index
  //   const lockPeriodYieldIndex = position.lockPeriodYieldIndex;
  //   const lockPeriodYield =
  //     configAccount.lockPeriodYields[lockPeriodYieldIndex];
  //   const yieldRate = lockPeriodYield.yieldRate.toNumber();
  //
  //   // Expected yield = staked amount * yield_rate / 10000
  //   const stakeAmount = position.amount.toNumber();
  //   const yieldAmount = Math.floor(stakeAmount * (yieldRate / 10000));
  //   const expectedFinalAmount = stakeAmount + yieldAmount;
  //   const expectedBalance = userBalanceBefore + expectedFinalAmount;
  //
  //   console.log(
  //     "Lock period yield used:",
  //     LockPeriod[lockPeriodYield.lockPeriod],
  //     "days"
  //   );
  //   console.log("Yield rate applied:", yieldRate / 100, "%");
  //   console.log("User balance after:", userTokenBalance);
  //   console.log("Expected final amount:", expectedFinalAmount);
  //   console.log("Expected balance after:", expectedBalance);
  //
  //   expect(userTokenBalance).to.be.approximately(expectedBalance, 2); // Allow small rounding differences
  //
  //   // 2. Check program's token vault balance decreased
  //   const vaultBalance = await getTokenBalance(client, vaultAta);
  //   expect(vaultBalance).to.equal(vaultBalanceBefore - expectedFinalAmount);
  //   console.log("Vault balance after:", vaultBalance);
  //
  //   // 3. Check position account was updated to claimed status
  //   const positionAfter = await sdk.fetchPosition(
  //     payer.publicKey,
  //     positionId,
  //     tokenMint
  //   );
  //   expect(positionAfter.status).to.deep.equal({ claimed: {} });
  //   console.log("Position status after claiming:", positionAfter.status);
  //
  //   // 4. Check config's total staked amount was decreased
  //   const configAfter = await sdk.fetchConfigByAddress(configPda);
  //   expect(configAfter.totalStakedAmount.toNumber()).to.equal(
  //     configAccount.totalStakedAmount.toNumber() - stakeAmount
  //   );
  //   console.log(
  //     "Total staked amount after claiming:",
  //     configAfter.totalStakedAmount.toString()
  //   );
  //
  //   console.log("Claim position test completed successfully");
  // });
  //
  // it("Stakes a Metaplex Core asset successfully", async () => {
  //   const poolIndex = 3;
  //
  //   // Get the Config PDA and account data with our configId
  //   const [configPda] = sdk.pda.findConfigPda(payer.publicKey, configId);
  //   const configAccount = await sdk.fetchConfigByAddress(configPda);
  //
  //   // NOTE: You no longer need to init position.
  //
  //   // try {
  //   //   // Use a distinct position ID for the NFT stake
  //   //
  //   //   // First, initialize the position for the NFT
  //   //   console.log("Initializing position for NFT staking...");
  //   //   const initPositionIx = await sdk.initializePosition({
  //   //     authority: payer.publicKey,
  //   //     owner: payer.publicKey,
  //   //     tokenMint,
  //   //     configId,
  //   //     positionId: nftPositionId,
  //   //     lockPeriodYieldIndex,
  //   //     positionType: PositionType.NFT,
  //   //   });
  //   //
  //   //   // Process the initialize position transaction
  //   //   await createAndProcessTransaction(client, payer, [initPositionIx]);
  //   //   console.log("NFT position initialized successfully");
  //   // } catch (err) {
  //   //   console.error("Failed to stake NFT:", err);
  //   //   expect.fail(`NFT staking failed: ${err}`);
  //   // }
  //
  //   console.log("Staking a single Metaplex Core asset...");
  //   console.log("Owner:", payer.publicKey.toString());
  //   console.log("Asset:", assetSigner.publicKey.toString());
  //   console.log("Collection:", collectionSigner.publicKey.toString());
  //
  //   // Find the Position PDA for this owner, mint and positionId
  //   const [positionPda] = sdk.pda.findPositionPda(
  //     payer.publicKey,
  //     tokenMint,
  //     nftPositionId
  //   );
  //   console.log("Position PDA:", positionPda.toString());
  //
  //   // Create the stake NFT instruction
  //   const stakeNftIx = await sdk.stakeNft({
  //     authority: payer.publicKey,
  //     owner: payer.publicKey,
  //     mint: tokenMint,
  //     collection: toWeb3JsPublicKey(collectionSigner.publicKey),
  //     asset: toWeb3JsPublicKey(assetSigner.publicKey),
  //     updateAuthority: payer.publicKey,
  //     payer: payer.publicKey,
  //     configId,
  //     poolIndex,
  //   });
  //
  //   // Process the transaction
  //   await createAndProcessTransaction(
  //     client,
  //     payer,
  //     [stakeNftIx],
  //     [toWeb3JsKeypair(collectionSigner)]
  //   );
  //   console.log("NFT staked successfully");
  //
  //   // Verify the position was updated correctly
  //   const position = await sdk.fetchPosition(
  //     payer.publicKey,
  //     nftPositionId,
  //     tokenMint
  //   );
  //
  //   expect(position).to.not.be.null;
  //   expect(position.owner.toString()).to.equal(payer.publicKey.toString());
  //   expect(position.positionType).to.deep.equal({ nft: {} });
  //   expect(position.amount.toNumber()).to.equal(nftValueInTokens);
  //   expect(position.lockPeriodYieldIndex).to.equal(poolIndex);
  //
  //   // Verify the staked NFT is in the position's nft_mints array
  //   expect(position.nftMints[0].toString()).to.equal(
  //     assetSigner.publicKey.toString()
  //   );
  //   expect(position.nftIndex).to.equal(1); // Should have 1 NFT staked
  //
  //   console.log("Position after staking NFT:");
  //   console.log("- Owner:", position.owner.toString());
  //   console.log("- Amount:", position.amount.toString());
  //   console.log("- Position Type:", position.positionType);
  //   console.log("- Lock Period Yield Index:", position.lockPeriodYieldIndex);
  //   console.log("- NFT Index:", position.nftIndex);
  //   console.log("- NFT Mint:", position.nftMints[0].toString());
  //
  //   // Verify config total staked amount increased
  //   const updatedConfig = await sdk.fetchConfigByAddress(configPda);
  //   const expectedTotalStaked =
  //     configAccount.totalStakedAmount.toNumber() + nftValueInTokens;
  //   expect(updatedConfig.totalStakedAmount.toNumber()).to.equal(
  //     expectedTotalStaked
  //   );
  //
  //   console.log(
  //     "Total staked amount updated:",
  //     updatedConfig.totalStakedAmount.toString()
  //   );
  //
  //   const assetData = await getMplCoreAsset(
  //     client,
  //     toWeb3JsPublicKey(assetSigner.publicKey)
  //   );
  //
  //   // Verify the asset has been updated with staking attributes
  //   if (assetData.pluginHeader) {
  //     console.log("Asset pluginHeaders after staking:", assetData.pluginHeader);
  //
  //     // Check if the FreezeDelegate pluginHeader was added and asset is frozen
  //     expect(assetData.freezeDelegate).to.not.be.undefined;
  //     expect(assetData.freezeDelegate.frozen).to.be.true;
  //     console.log(
  //       "Asset successfully frozen:",
  //       assetData.freezeDelegate.frozen
  //     );
  //
  //     // Check if attributes plugin was added with staking information
  //     expect(assetData.attributes).to.not.be.undefined;
  //     const stakedAttr = assetData.attributes.attributeList.find(
  //       (attr) => attr.key === "staked"
  //     );
  //     expect(stakedAttr).to.not.be.undefined;
  //     expect(stakedAttr.value).to.not.equal("0"); // TODO: Verify that timestamp matches the indeShould contain a timestamp
  //     console.log("Staking attribute added:", stakedAttr);
  //
  //     const stakedTimeAttr = assetData.attributes.attributeList.find(
  //       (attr) => attr.key === "staked_time"
  //     );
  //     expect(stakedTimeAttr).to.not.be.undefined;
  //     console.log("Staked time attribute:", stakedTimeAttr);
  //   }
  // });
});
