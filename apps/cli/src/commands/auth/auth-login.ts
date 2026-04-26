import { executeAuthLoginCommand } from './auth-login-command';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerAuthLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with a OneKey App Bot Wallet or hardware device')
    .option('--app-transfer', 'Authenticate with a OneKey App Bot Wallet')
    .option(
      '--hardware',
      'Authenticate with a connected hardware wallet device',
    )
    .option(
      '--device-id <id>',
      'Target device UUID (from `onekey device search`). Required when multiple devices are connected.',
    )
    .option(
      '--passphrase-mode <mode>',
      'Hardware wallet passphrase mode: none | on-host | on-device',
    )
    .action(
      async (
        options: {
          appTransfer?: boolean;
          hardware?: boolean;
          deviceId?: string;
          passphraseMode?: string;
        },
        command: Command,
      ) => {
        const globalOpts = command.optsWithGlobals();
        const output = globalOpts._outputFormatter as OutputFormatter;

        await executeAuthLoginCommand({
          output,
          appTransferFlag: options.appTransfer,
          hardwareFlag: options.hardware,
          deviceIdHint: options.deviceId,
          passphraseMode: options.passphraseMode,
          isHumanMode: output.getMode() === 'human',
          isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
          env: (globalOpts.env as 'test' | 'prod' | undefined) ?? 'prod',
          exit: (code) => process.exit(code),
        });
      },
    );
}
