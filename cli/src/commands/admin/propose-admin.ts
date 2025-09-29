import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { getSDK, getWallet } from "../../utils/connection";
import ora from "ora";

/**
 * Command to propose a new admin for the staking protocol
 */
export function proposeAdminCommand(program: Command): void {
  program
    .command("admin:propose-admin")
    .description("Propose a new admin for the staking protocol")
    .requiredOption("-a, --new-admin <address>", "Public key of the new admin")
    .option("-id, --config-id <number>", "Config ID", "1")
    .action(async (options) => {
      try {
        const spinner = ora("Proposing admin transfer...").start();

        const sdk = getSDK();
        const wallet = getWallet();

        // Parse options
        const configId = parseInt(options.configId);
        const newAdminPubkey = new PublicKey(options.newAdmin);

        // Find the config PDA
        const [configPda] = sdk.pda.findConfigPda(configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Find the proposed admin PDA
        const [proposedAdminPda] = sdk.pda.findProposedAdminPda(configPda);
        spinner.text = `Proposed Admin PDA: ${proposedAdminPda.toString()}`;

        // Check if there's already a pending proposal
        try {
          const existingProposal = await sdk.program.account.proposedAdmin.fetch(proposedAdminPda);
          if (existingProposal) {
            spinner.warn(`Admin transfer already proposed to: ${existingProposal.authority.toString()}`);
            console.log(`\nExisting proposal details:`);
            console.log(`- Proposed Admin: ${existingProposal.authority.toString()}`);
            console.log(`\nTo replace this proposal, the new admin must first accept or reject the current proposal.`);
            return;
          }
        } catch (error) {
          // No existing proposal found, proceed
        }

        // Fetch current config to show current admin
        const currentConfig = await sdk.fetchConfigByAddress(configPda);
        if (currentConfig) {
          console.log(`\nCurrent admin: ${currentConfig.authority.toString()}`);
          console.log(`Proposed new admin: ${newAdminPubkey.toString()}`);
        }

        // Use the RPC method to directly execute the transaction
        const txid = await sdk.proposeAdminTransferRpc({
          authority: wallet.publicKey,
          configId,
          newAdmin: newAdminPubkey,
        });

        spinner.succeed(`Admin transfer proposed successfully. Tx: ${txid}`);

        // Fetch and display the proposal details
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const proposalAccount = await sdk.program.account.proposedAdmin.fetch(proposedAdminPda);

        console.log(`\nProposal Details:`);
        console.log(`- Proposal PDA: ${proposedAdminPda.toString()}`);
        console.log(`- Current Authority: ${currentConfig?.authority.toString()}`);
        console.log(`- Proposed Authority: ${proposalAccount.authority.toString()}`);

      } catch (error) {
        ora().fail(`Failed to propose admin transfer: ${error}`);
        console.error(error);
      }
    });
}