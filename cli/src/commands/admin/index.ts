import { Command } from "commander";
import { pausePoolCommand } from "./pause-pool";
import { activatePoolCommand } from "./activate-pool";
import { setPoolConfigCommand } from "./set-pool-config";
import { withdrawTokensCommand } from "./withdraw-tokens";

/**
 * Register all admin commands
 */
export function registerAdminCommands(program: Command): void {
  // Create admin command group
  const adminCommand = program
    .command("admin")
    .description("Admin commands for managing the BERT Staking protocol");

  // Register individual admin commands
  pausePoolCommand(program);
  activatePoolCommand(program);
  setPoolConfigCommand(program);
  withdrawTokensCommand(program);
}

