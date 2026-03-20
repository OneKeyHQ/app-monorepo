import type { Command } from 'commander';
import type { OutputFormatter } from '../output';

export function registerVersionCommand(program: Command): void {
  program
    .command('version')
    .description('Print version information')
    .action((_options, command) => {
      const output = command.optsWithGlobals()._outputFormatter as OutputFormatter;
      const opts = command.optsWithGlobals();
      output.success({
        version: '0.1.0',
        env: opts.env ?? 'test',
      });
    });
}
