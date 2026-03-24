import { registerTokenInfoCommand } from './token-info';
import { registerTokenPriceCommand } from './token-price';
import { registerTokenSearchCommand } from './token-search';

import type { Command } from 'commander';

export function registerTokenCommands(program: Command) {
  const token = program
    .command('token')
    .description('Token discovery and analysis');

  registerTokenSearchCommand(token);
  registerTokenInfoCommand(token);
  registerTokenPriceCommand(token);
}
