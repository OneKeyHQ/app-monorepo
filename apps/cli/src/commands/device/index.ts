import { registerDevicePassphraseCommand } from './device-passphrase';
import { registerDevicePinCommand } from './device-pin';
import { registerDeviceSearchCommand } from './device-search';
import { registerDeviceSettingsCommand } from './device-settings';
import { registerDeviceVerifyCommand } from './device-verify';

import type { Command } from 'commander';

export function registerDeviceCommands(program: Command) {
  const device = program
    .command('device')
    .description('OneKey hardware device management');

  registerDeviceSearchCommand(device);
  registerDeviceVerifyCommand(device);
  registerDevicePinCommand(device);
  registerDevicePassphraseCommand(device);
  registerDeviceSettingsCommand(device);
}
