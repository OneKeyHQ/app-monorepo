import { AppError } from '../../errors';

import { ensureSDKReady, searchDevice } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { CoreApi } from '@onekeyfe/hd-core';
import type { Command } from 'commander';

export interface IDeviceActionContext {
  sdk: CoreApi;
  connectId: string;
  output: OutputFormatter;
}

/**
 * Shared scaffolding for device subcommands:
 *  - pulls the OutputFormatter from global options
 *  - boots the hardware SDK + searches for a connected device
 *  - translates thrown errors into the CLI error contract (output + exitCode)
 *
 * Use this for any subcommand that acts on a single connected device.
 * `device search` does not fit (enumerates all devices) — it handles its own
 * try/catch directly.
 */
export async function runDeviceAction(
  command: Command,
  handler: (ctx: IDeviceActionContext) => Promise<void>,
): Promise<void> {
  const globalOpts = command.optsWithGlobals();
  const output = globalOpts._outputFormatter as OutputFormatter;

  try {
    const sdk = await ensureSDKReady();
    const { connectId } = await searchDevice();
    await handler({ sdk, connectId, output });
  } catch (error) {
    const appError = AppError.from(error);
    output.error(appError.toErrorDetail());
    process.exitCode = appError.exitCode;
  }
}
