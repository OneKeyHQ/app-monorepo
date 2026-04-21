import { AppError, ERROR_CODES } from '../../errors';

import { ensureSDKReady, searchDevice, unwrapSDKResult } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerDevicePassphraseCommand(parent: Command): void {
  parent
    .command('toggle-passphrase')
    .description('Enable or disable passphrase (hidden wallet) protection')
    .requiredOption('--enable <bool>', 'true to enable, false to disable')
    .action(async (options: { enable: string }, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        if (options.enable !== 'true' && options.enable !== 'false') {
          throw new AppError(
            ERROR_CODES.PARAM_INVALID_CONFIG.code,
            `Invalid --enable value: "${options.enable}"`,
            'Use --enable true or --enable false',
          );
        }

        const sdk = await ensureSDKReady();
        const { connectId } = await searchDevice();
        const enable = options.enable === 'true';

        // useEmptyPassphrase: true — toggling passphrase is a device-level operation,
        // independent of any hidden wallet session.
        const result = await sdk.deviceSettings(connectId, {
          usePassphrase: enable,
          useEmptyPassphrase: true,
        });
        unwrapSDKResult(result, 'togglePassphrase');

        output.success({
          status: enable ? 'passphrase_enabled' : 'passphrase_disabled',
          connectId,
        });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
