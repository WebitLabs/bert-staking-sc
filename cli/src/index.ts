import { Command } from "commander";
import figlet from "figlet";
import chalk from "chalk";
import { initializeCommand } from "./commands/initialize";
import { fetchConfigCommand } from "./commands/fetch-config";
import { fetchPositionCommand } from "./commands/fetch-position";
import { fetchUserPoolStatsCommand } from "./commands/fetch-user-pool-stats";
import { setupConnection } from "./utils/connection";
import { stakeTokenCommand } from "./commands/stake-token";
import { stakeNftCommand } from "./commands/stake-nft";
import { claimTokenCommand } from "./commands/claim-token";
import { claimNftCommand } from "./commands/claim-nft";
import { createTokenCommand } from "./commands/create-token";
import { createCoreNftCommand } from "./commands/create-nft";
import { transferCoreNftCommand } from "./commands/transfer-nft";
import { registerAdminCommands } from "./commands/admin";

// Create CLI program
const program = new Command();

// Display banner
console.log(
  chalk.yellow(
    figlet.textSync("BERT Staking CLI", { horizontalLayout: "full" })
  )
);

// Program metadata
program
  .name("bert-staking")
  .description("CLI tool for managing the BERT Staking Protocol")
  .version("0.1.0")
  .hook("preAction", (thisCommand) => {
    // Setup connection before any command runs
    setupConnection(thisCommand);
  });

// Register commands
createTokenCommand(program);
createCoreNftCommand(program);
transferCoreNftCommand(program);
initializeCommand(program);

// Staking commands
stakeTokenCommand(program);
stakeNftCommand(program);
// claimTokenCommand(program);
// claimNftCommand(program);

// Query commands
fetchConfigCommand(program);
fetchPositionCommand(program);
fetchUserPoolStatsCommand(program);

// Register admin commands
registerAdminCommands(program);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
