import { AppError, ERROR_CODES } from '../../errors';

import { runDeviceAction } from './device-runner';
import { unwrapSDKResult } from './hardware-sdk';

import type { Command } from 'commander';

export function registerDeviceSettingsCommand(parent: Command): void {
  parent
    .command('settings')
    .description('Update device settings (label, auto-lock, haptic feedback)')
    .option('--label <name>', 'Device display name')
    .option('--auto-lock-delay <seconds>', 'Auto-lock timeout in seconds')
    .option(
      '--haptic-feedback <bool>',
      'Enable/disable haptic feedback (true/false)',
    )
    .action(
      async (
        options: {
          label?: string;
          autoLockDelay?: string;
          hapticFeedback?: string;
        },
        command: Command,
      ) =>
        runDeviceAction(command, async ({ sdk, connectId, output }) => {
          const params: Record<string, unknown> = {};
          if (options.label !== undefined) params.label = options.label;
          if (options.autoLockDelay !== undefined) {
            // Strict positive integer in [10, 86400] seconds.
            // Device firmware rejects obviously-broken values anyway, but
            // `parseInt('abc')` → NaN would be sent as `NaN * 1000 = NaN`
            // without this guard, producing a cryptic SDK error instead of
            // a clear CLI validation message.
            if (!/^\d+$/.test(options.autoLockDelay)) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CONFIG.code,
                `Invalid --auto-lock-delay value: "${options.autoLockDelay}"`,
                'Pass a positive integer number of seconds (e.g. 60).',
              );
            }
            const seconds = parseInt(options.autoLockDelay, 10);
            const MIN_AUTO_LOCK_SECONDS = 10;
            const MAX_AUTO_LOCK_SECONDS = 86_400; // 24 h
            if (
              !Number.isSafeInteger(seconds) ||
              seconds < MIN_AUTO_LOCK_SECONDS ||
              seconds > MAX_AUTO_LOCK_SECONDS
            ) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CONFIG.code,
                `Invalid --auto-lock-delay: ${seconds} (must be between ${MIN_AUTO_LOCK_SECONDS} and ${MAX_AUTO_LOCK_SECONDS} seconds)`,
                'Use a value between 10 s and 86400 s (24 h).',
              );
            }
            params.autoLockDelayMs = seconds * 1000;
          }
          if (options.hapticFeedback !== undefined) {
            if (
              options.hapticFeedback !== 'true' &&
              options.hapticFeedback !== 'false'
            ) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CONFIG.code,
                `Invalid --haptic-feedback value: "${options.hapticFeedback}"`,
                'Use --haptic-feedback true or --haptic-feedback false.',
              );
            }
            params.hapticFeedback = options.hapticFeedback === 'true';
          }

          if (Object.keys(params).length === 0) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_CONFIG.code,
              'No settings provided',
              'Use --label, --auto-lock-delay, or --haptic-feedback',
            );
          }

          // useEmptyPassphrase: true — device settings are wallet-independent;
          // consistent with device-verify.
          const result = await sdk.deviceSettings(connectId, {
            ...params,
            useEmptyPassphrase: true,
          });
          unwrapSDKResult(result, 'deviceSettings');

          output.success({
            status: 'settings_updated',
            connectId,
            applied: params,
          });
        }),
    );
}
