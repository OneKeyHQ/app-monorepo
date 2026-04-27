import { randomBytes } from 'node:crypto';

import { runDeviceAction } from './device-runner';
import { unwrapSDKResult } from './hardware-sdk';

import type { Command } from 'commander';

export function registerDeviceVerifyCommand(parent: Command): void {
  parent
    .command('verify')
    .description('Verify device authenticity (anti-tampering check)')
    .action(async (_options: Record<string, unknown>, command: Command) =>
      runDeviceAction(command, async ({ sdk, connectId, output }) => {
        // Cryptographically strong challenge for anti-tampering verification.
        // A predictable challenge would let a tampered device replay a
        // previously captured signature, defeating the attestation.
        const dataHex = randomBytes(32).toString('hex');
        const result = await sdk.deviceVerify(connectId, {
          dataHex,
          useEmptyPassphrase: true,
        });
        const payload = unwrapSDKResult(result, 'deviceVerify');

        output.success({
          verified: true,
          connectId,
          ...(payload as Record<string, unknown>),
        });
      }),
    );
}
