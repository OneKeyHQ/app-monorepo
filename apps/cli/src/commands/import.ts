import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

import { encrypt, secureWipe } from '../core/crypto-utils';
import { AppError, ERROR_CODES } from '../errors';
import { KeychainStorage } from '../infra/keychain-storage';
import {
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
  getSignerByImpl,
} from '../signer';

import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

function readHiddenInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput =
      (s: string) => {
        if (s.includes(prompt)) {
          process.stderr.write(s);
        }
      };
    rl.question(prompt, (answer) => {
      process.stderr.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

function readStdinPipe(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function normalizeMnemonic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Import a BIP39 mnemonic wallet')
    .option('--mnemonic', 'Import via BIP39 mnemonic phrase')
    .option('--force', 'Overwrite existing wallet without prompting')
    .action(
      async (options: { mnemonic?: boolean; force?: boolean }, command) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;
        let mnemonicBuf: Buffer | null = null;

        try {
          if (!options.mnemonic) {
            output.error({
              code: ERROR_CODES.PARAM_MISSING_REQUIRED.code,
              message: 'Import method required. Use --mnemonic.',
              suggestion: 'Run: onekey import --mnemonic',
            });
            process.exitCode = ERROR_CODES.PARAM_MISSING_REQUIRED.exitCode;
            return;
          }

          let raw: string;
          if (process.stdin.isTTY) {
            raw = await readHiddenInput('Enter BIP39 mnemonic: ');
          } else {
            raw = await readStdinPipe();
          }

          const normalized = normalizeMnemonic(raw);
          mnemonicBuf = Buffer.from(normalized, 'utf-8');

          const keychain = new KeychainStorage();
          const existing = await keychain.get(KEYCHAIN_MNEMONIC_KEY);

          if (existing && !options.force) {
            if (output.getMode() === 'human') {
              const rl = createInterface({
                input: process.stdin,
                output: process.stderr,
                terminal: true,
              });
              const confirmed = await new Promise<boolean>((resolve) => {
                rl.question(
                  'A wallet already exists. Replace it? (y/N): ',
                  (answer) => {
                    rl.close();
                    resolve(
                      answer.toLowerCase() === 'y' ||
                        answer.toLowerCase() === 'yes',
                    );
                  },
                );
              });
              if (!confirmed) {
                output.info('Import cancelled.');
                return;
              }
            } else {
              throw new AppError(
                ERROR_CODES.AUTH_WALLET_EXISTS.code,
                'Wallet already exists. Use --force to overwrite.',
                'Run: onekey import --mnemonic --force',
              );
            }
          }

          // Validate mnemonic by encrypting + deriving address BEFORE writing to Keychain.
          // This ensures invalid mnemonics never get persisted.
          const encryptionKey = randomBytes(32).toString('hex');
          const encrypted = await encrypt(mnemonicBuf, encryptionKey);

          // Derive address in-memory to validate mnemonic (uses revealableSeedFromMnemonic)
          const { revealableSeedFromMnemonic } =
            await import('@onekeyhq/core/src/secret');
          await revealableSeedFromMnemonic(normalized, 'onekey');

          // Mnemonic is valid — now persist to Keychain
          await keychain.set(
            KEYCHAIN_ENCRYPTION_KEY,
            Buffer.from(encryptionKey, 'utf-8'),
          );
          await keychain.set(KEYCHAIN_MNEMONIC_KEY, encrypted);

          // Derive address for display
          const signer = await getSignerByImpl('evm');
          const addressInfo = await signer.getAddress('evm--1');

          output.success({ address: addressInfo.address });
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        } finally {
          if (mnemonicBuf) secureWipe(mnemonicBuf);
        }
      },
    );
}
