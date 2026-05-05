import { registerSwapBuildCommand } from './swap-build';
import { registerSwapExecuteCommand } from './swap-execute';
import { registerSwapHistoryCommand } from './swap-history';
import { registerSwapNetworksCommand } from './swap-networks';
import { registerSwapQuoteCommand } from './swap-quote';
import { registerSwapStatusCommand } from './swap-status';

import type { Command } from 'commander';

export function registerSwapCommands(program: Command) {
  const swap = program
    .command('swap')
    .description('Token swap quotes and execution');

  registerSwapQuoteCommand(swap);
  registerSwapBuildCommand(swap);
  registerSwapExecuteCommand(swap);
  registerSwapStatusCommand(swap);
  registerSwapNetworksCommand(swap);
  registerSwapHistoryCommand(swap);
}
