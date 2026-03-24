import type { Command } from 'commander';

export function registerSwapCommands(program: Command) {
  program.command('swap').description('Token swap quotes and execution');
}
