import { AppError } from '../../errors';

import { ensureSDKReady, searchDevice, unwrapSDKResult } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerDevicePinCommand(parent: Command): void {
  parent
    .command('change-pin')
    .description('Change or remove device PIN')
    .option('--remove', 'Remove PIN protection (not recommended)')
    .action(async (options: { remove?: boolean }, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const sdk = await ensureSDKReady();
        const { connectId } = await searchDevice();

        // useEmptyPassphrase: true — PIN management is device-level,
        // independent of any hidden wallet session.
        const result = await sdk.deviceChangePin(connectId, {
          remove: options.remove ?? false,
          useEmptyPassphrase: true,
        });
        unwrapSDKResult(result, 'changePin');

        output.success({
          status: options.remove ? 'pin_removed' : 'pin_changed',
          connectId,
        });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
