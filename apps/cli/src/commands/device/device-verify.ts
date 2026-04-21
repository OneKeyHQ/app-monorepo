import { randomBytes } from 'node:crypto';

import { AppError } from '../../errors';

import { ensureSDKReady, searchDevice, unwrapSDKResult } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerDeviceVerifyCommand(parent: Command): void {
  parent
    .command('verify')
    .description('Verify device authenticity (anti-tampering check)')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const sdk = await ensureSDKReady();
        const { connectId } = await searchDevice();

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
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
