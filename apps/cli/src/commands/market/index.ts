import { registerMarketPriceCommand } from './market-price';
import { registerMarketPricesCommand } from './market-prices';

import type { Command } from 'commander';

export function registerMarketCommands(program: Command) {
  const market = program
    .command('market')
    .description('Market data and price feeds');

  registerMarketPriceCommand(market);
  registerMarketPricesCommand(market);
}
