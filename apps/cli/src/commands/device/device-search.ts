import { AppError } from '../../errors';

import { ensureSDKReady, unwrapSDKResult } from './hardware-sdk';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

/** Minimal shape of a device returned by sdk.searchDevices() */
interface ISearchedDevice {
  connectId?: string;
  deviceId?: string;
  deviceType?: string;
  uuid?: string;
  name?: string;
  label?: string;
  firmwareVersion?: [number, number, number] | null;
  features?: {
    deviceType?: string;
    serialNo?: string;
    firmwareVersion?: string;
    unlocked?: boolean;
    passphraseProtection?: boolean;
  };
}

function formatVersion(version?: [number, number, number] | null): string {
  return Array.isArray(version) ? version.join('.') : '';
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

        const formatted = (devices as ISearchedDevice[]).map((d) => {
          return {
            connectId: d.connectId,
            deviceId: d.deviceId ?? '',
            name: d.name ?? d.label ?? 'Unknown',
            model: d.deviceType ?? d.features?.deviceType ?? 'Unknown',
            serial: d.uuid ?? d.features?.serialNo ?? '',
            firmware:
              formatVersion(d.firmwareVersion) ||
              d.features?.firmwareVersion ||
              '',
            unlocked: d.features?.unlocked ?? null,
            passphraseProtection: d.features?.passphraseProtection ?? false,
          };
        });

        output.success({ devices: formatted, count: formatted.length });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
