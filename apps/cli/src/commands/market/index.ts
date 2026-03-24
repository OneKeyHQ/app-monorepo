import type { Command } from 'commander';

export function registerMarketCommands(program: Command) {
  program.command('market').description('Market data and price feeds');
}
