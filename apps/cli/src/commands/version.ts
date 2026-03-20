import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

export function registerVersionCommand(program: Command): void {
  program
    .command('version')
    .description('Print version information')
    .action((_options, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;
      output.success({
        version: '0.1.0',
        env: (globalOpts.env as string) ?? 'test',
      });
    });
}
