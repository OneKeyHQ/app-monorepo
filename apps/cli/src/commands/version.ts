import { version as PKG_VERSION } from '../../package.json';

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
        version: PKG_VERSION,
        env: (globalOpts.env as string) ?? 'prod',
      });
    });
}
