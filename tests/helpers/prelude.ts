import { Keypair } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import path from "path";
import {
  ProgramTestContext,
  BanksClient,
  AddedAccount,
  startAnchor,
  AddedProgram,
} from "solana-bankrun";

// Get the project root directory - MAYBE use it to startAnchor
const _projectDir = path.resolve(__dirname, "..");

const PROJECT_DIRECTORY = "";

export async function prelude(
  extraPrograms: AddedProgram[] = [],
  extraAccounts: AddedAccount[] = []
) {
  let context: ProgramTestContext;
  let client: BanksClient;
  let payer: Keypair;
  let provider: BankrunProvider;

  context = await startAnchor(PROJECT_DIRECTORY, extraPrograms, extraAccounts);
  client = context.banksClient;
  payer = context.payer;
  provider = new BankrunProvider(context);

  return {
    context,
    client,
    payer,
    provider,
  };
}
