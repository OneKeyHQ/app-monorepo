import { registerTokenInfoCommand } from './token-info';
import { registerTokenLiquidityCommand } from './token-liquidity';
import { registerTokenPriceCommand } from './token-price';
import { registerTokenSearchCommand } from './token-search';
import { registerTokenTradesCommand } from './token-trades';
import { registerTokenTrendingCommand } from './token-trending';

import type { Command } from 'commander';

export function registerTokenCommands(program: Command) {
  const token = program
    .command('token')
    .description('Token discovery and analysis');

  registerTokenSearchCommand(token);
  registerTokenInfoCommand(token);
  registerTokenPriceCommand(token);
  registerTokenTrendingCommand(token);
  registerTokenTradesCommand(token);
  registerTokenLiquidityCommand(token);
}
