import { registerSwapQuoteCommand } from './swap-quote';

import type { Command } from 'commander';

export function registerSwapCommands(program: Command) {
  const swap = program
    .command('swap')
    .description('Token swap quotes and execution');

  registerSwapQuoteCommand(swap);
}
