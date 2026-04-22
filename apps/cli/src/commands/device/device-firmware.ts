import { runDeviceAction } from './device-runner';
import { unwrapSDKResult } from './hardware-sdk';

import type { Command } from 'commander';

export function registerDeviceFirmwareCommand(parent: Command): void {
  parent
    .command('firmware')
    .description('Check device firmware version and available updates')
    .action(async (_options: Record<string, unknown>, command: Command) =>
      runDeviceAction(command, async ({ sdk, connectId, output }) => {
        const result = await sdk.checkFirmwareRelease(connectId);
        const payload = unwrapSDKResult(result, 'checkFirmwareRelease');

        output.success({
          connectId,
          ...(payload as Record<string, unknown>),
        });
      }),
    );
}
