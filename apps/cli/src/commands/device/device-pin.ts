import { runDeviceAction } from './device-runner';
import { unwrapSDKResult } from './hardware-sdk';

import type { Command } from 'commander';

export function registerDevicePinCommand(parent: Command): void {
  parent
    .command('change-pin')
    .description('Change or remove device PIN')
    .option('--remove', 'Remove PIN protection (not recommended)')
    .action(async (options: { remove?: boolean }, command: Command) =>
      runDeviceAction(command, async ({ sdk, connectId, output }) => {
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
      }),
    );
}
