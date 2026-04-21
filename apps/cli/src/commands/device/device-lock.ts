import { AppError } from '../../errors';

import { ensureSDKReady, searchDevice, unwrapSDKResult } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerDeviceLockCommand(parent: Command): void {
  parent
    .command('lock')
    .description('Lock the connected hardware device')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const sdk = await ensureSDKReady();
        const { connectId } = await searchDevice();

        const result = await sdk.deviceLock(connectId, {
          useEmptyPassphrase: true,
        });
        unwrapSDKResult(result, 'deviceLock');

        output.success({ status: 'locked', connectId });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
