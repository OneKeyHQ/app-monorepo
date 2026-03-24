import type { Command } from 'commander';

export function registerTokenCommands(program: Command) {
  program.command('token').description('Token discovery and analysis');
}
