import { registerWalletAddressCommand } from './wallet-address';
import { registerWalletAddressTypesCommand } from './wallet-address-types';

import type { Command } from 'commander';

export function registerWalletCommands(program: Command): void {
  const wallet = program.command('wallet').description('Wallet address tools');

  registerWalletAddressTypesCommand(wallet);
  registerWalletAddressCommand(wallet);
}
