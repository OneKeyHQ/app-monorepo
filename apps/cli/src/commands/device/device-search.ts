import { AppError } from '../../errors';

import { ensureSDKReady, unwrapSDKResult } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

/** Minimal shape of a device returned by sdk.searchDevices() */
interface ISearchedDevice {
  connectId?: string;
  deviceId?: string;
  name?: string;
  label?: string;
  features?: {
    onekey_device_type?: string;
    onekey_serial?: string;
    onekey_firmware_version?: string;
    unlocked?: boolean;
    passphrase_protection?: boolean;
  };
}

export function registerDeviceSearchCommand(parent: Command): void {
  parent
    .command('search')
    .description('Search for connected OneKey hardware devices')
    .action(async (_options: Record<string, unknown>, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const sdk = await ensureSDKReady();
        const result = await sdk.searchDevices();
        const devices = unwrapSDKResult(result, 'searchDevices');

        if (!Array.isArray(devices) || devices.length === 0) {
          output.success({ devices: [], count: 0 });
          return;
        }

        const formatted = (devices as ISearchedDevice[]).map((d) => ({
          connectId: d.connectId,
          deviceId: d.deviceId,
          name: d.name ?? d.label ?? 'Unknown',
          model: d.features?.onekey_device_type ?? 'Unknown',
          serial: d.features?.onekey_serial ?? '',
          firmware: d.features?.onekey_firmware_version ?? '',
          unlocked: d.features?.unlocked ?? null,
          passphraseProtection: d.features?.passphrase_protection ?? false,
        }));

        output.success({ devices: formatted, count: formatted.length });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
