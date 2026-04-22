import { runDeviceAction } from './device-runner';
import { unwrapSDKResult } from './hardware-sdk';

import type { Command } from 'commander';

export function registerDeviceLockCommand(parent: Command): void {
  parent
    .command('lock')
    .description('Lock the connected hardware device')
    .action(async (_options: Record<string, unknown>, command: Command) =>
      runDeviceAction(command, async ({ sdk, connectId, output }) => {
        const result = await sdk.deviceLock(connectId, {
          useEmptyPassphrase: true,
        });
        unwrapSDKResult(result, 'deviceLock');

        output.success({ status: 'locked', connectId });
      }),
    );
}
