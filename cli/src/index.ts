#!/usr/bin/env node
import { Command } from "commander";
import figlet from "figlet";
import chalk from "chalk";
import { initializeCommand } from "./commands/initialize";
import { fetchConfigCommand } from "./commands/fetch-config";
import { fetchPositionCommand } from "./commands/fetch-position";
import { setupConnection } from "./utils/connection";
import { initializePositionCommand } from "./commands/initialize-position";
import { stakeTokenCommand } from "./commands/stake-token";

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
initializeCommand(program);
initializePositionCommand(program);
stakeTokenCommand(program);
fetchConfigCommand(program);
fetchPositionCommand(program);

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

