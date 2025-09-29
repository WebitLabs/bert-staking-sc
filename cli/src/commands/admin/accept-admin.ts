import { Command } from "commander";
import { getSDK, getWallet } from "../../utils/connection";
import ora from "ora";

/**
 * Command to accept admin transfer for the staking protocol
 */
export function acceptAdminCommand(program: Command): void {
  program
    .command("admin:accept-admin")
    .description("Accept admin transfer for the staking protocol")
    .option("-id, --config-id <number>", "Config ID", "1")
    .action(async (options) => {
      try {
        const spinner = ora("Accepting admin transfer...").start();

        const sdk = getSDK();
        const wallet = getWallet();

        // Parse options
        const configId = parseInt(options.configId);

        // Find the config PDA
        const [configPda] = sdk.pda.findConfigPda(configId);
        spinner.text = `Config PDA: ${configPda.toString()}`;

        // Find the proposed admin PDA
        const [proposedAdminPda] = sdk.pda.findProposedAdminPda(configPda);
        spinner.text = `Proposed Admin PDA: ${proposedAdminPda.toString()}`;

        // Check if there's a pending proposal
        let proposalAccount;
        try {
          proposalAccount = await sdk.program.account.proposedAdmin.fetch(proposedAdminPda);
        } catch (error) {
          spinner.fail("No pending admin transfer proposal found.");
          console.log(`\nNo admin transfer proposal exists for config ID ${configId}.`);
          console.log(`Use "admin:propose-admin" command to create a proposal first.`);
          return;
        }

        // Get current config to show current admin
        const currentConfig = await sdk.fetchConfigByAddress(configPda);

        // Verify the current wallet is the proposed admin
        if (!proposalAccount.authority.equals(wallet.publicKey)) {
          spinner.fail("Access denied: You are not the proposed admin.");
          console.log(`\nProposal Details:`);
          console.log(`- Current Authority: ${currentConfig?.authority.toString()}`);
          console.log(`- Proposed Authority: ${proposalAccount.authority.toString()}`);
          console.log(`- Your Wallet: ${wallet.publicKey.toString()}`);
          console.log(`\nOnly the proposed admin can accept the transfer.`);
          return;
        }

        // Display proposal details before accepting
        console.log(`\nProposal Details:`);
        console.log(`- Current Authority: ${currentConfig?.authority.toString()}`);
        console.log(`- Proposed Authority: ${proposalAccount.authority.toString()}`);

        // Get current config state
        const configBefore = await sdk.fetchConfigByAddress(configPda);

        // Use the RPC method to directly execute the transaction
        const txid = await sdk.acceptAdminTransferRpc({
          authority: wallet.publicKey,
          oldAuthority: currentConfig!.authority,
          configId,
        });

        spinner.succeed(`Admin transfer accepted successfully. Tx: ${txid}`);

        // Fetch and display updated config
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const configAfter = await sdk.fetchConfigByAddress(configPda);

        console.log(`\nAdmin Transfer Completed:`);
        console.log(`- Previous Admin: ${configBefore?.authority.toString()}`);
        console.log(`- New Admin: ${configAfter?.authority.toString()}`);
        console.log(`- Config PDA: ${configPda.toString()}`);

        // Verify the proposal account was closed
        try {
          await sdk.program.account.proposedAdmin.fetch(proposedAdminPda);
          console.log(`\n⚠️  Warning: Proposal account still exists (may take time to reflect)`);
        } catch (error) {
          console.log(`\n✅ Proposal account successfully closed`);
        }

      } catch (error) {
        ora().fail(`Failed to accept admin transfer: ${error}`);
        console.error(error);
      }
    });
}