import { AppError } from '../../errors';

import { ensureSDKReady, searchDevice, unwrapSDKResult } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerDeviceFirmwareCommand(parent: Command): void {
  parent
    .command('firmware')
    .description('Check device firmware version and available updates')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const sdk = await ensureSDKReady();
        const { connectId } = await searchDevice();

        const result = await sdk.checkFirmwareRelease(connectId);
        const payload = unwrapSDKResult(result, 'checkFirmwareRelease');

        output.success({
          connectId,
          ...(payload as Record<string, unknown>),
        });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
