import type { Command } from 'commander';

export function registerSecurityCommands(program: Command) {
  program
    .command('security')
    .description('Address and transaction security checks');
}
