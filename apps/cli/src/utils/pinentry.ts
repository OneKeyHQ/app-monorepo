/**
 * Secure passphrase input via pinentry (macOS/Linux).
 *
 * Uses the system pinentry program (pinentry-mac on macOS) to display
 * a native dialog for passphrase entry. This ensures:
 *   - Passphrase never appears in shell history
 *   - Passphrase never appears in terminal output
 *   - Passphrase never enters LLM context (no CLI args, no env vars)
 *   - Input is handled by a trusted OS-level component
 */

import { execFile } from 'node:child_process';

import { AppError, ERROR_CODES } from '../errors';

const PINENTRY_PROGRAMS = [
  'pinentry-mac',
  'pinentry',
  'pinentry-gnome3',
  'pinentry-qt',
];

function findPinentry(): string | null {
  for (const prog of PINENTRY_PROGRAMS) {
    try {
      // Use `which` to check if the program exists in PATH
      const { execFileSync } =
        require('node:child_process') as typeof import('node:child_process');
      const result = execFileSync('which', [prog], {
        encoding: 'utf-8',
        timeout: 2000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (result.trim()) {
        return prog;
      }
    } catch {
      // Program not found, try next
    }
  }
  return null;
}

/**
 * Prompt for passphrase using pinentry (native OS dialog).
 *
 * The passphrase is entered in a secure OS dialog and returned as a string.
 * It never appears in the terminal, shell history, or process arguments.
 */
export function promptPassphraseViaPinentry(
  prompt = 'Enter passphrase for hidden wallet',
  description = 'OneKey Hardware Wallet',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const pinentryBin = findPinentry();
    if (!pinentryBin) {
      reject(
        new AppError(
          ERROR_CODES.PARAM_INVALID_CONFIG.code,
          'No pinentry program found (pinentry-mac, pinentry, etc.)',
          'Install pinentry: brew install pinentry-mac (macOS) or apt install pinentry (Linux)',
        ),
      );
      return;
    }

    const commands = [
      `SETDESC ${description}`,
      `SETPROMPT ${prompt}`,
      'GETPIN',
      'BYE',
    ].join('\n');

    const child = execFile(
      pinentryBin,
      [],
      { timeout: 120_000, encoding: 'utf-8' },
      (error, stdout, _stderr) => {
        if (error) {
          // User cancelled the dialog
          if (error.killed || (stdout && stdout.includes('ERR 83886179'))) {
            reject(
              new AppError(
                ERROR_CODES.USER_CANCELLED.code,
                'Passphrase entry cancelled by user',
                'Run the command again and enter your passphrase',
              ),
            );
            return;
          }
          reject(
            new AppError(
              ERROR_CODES.PARAM_INVALID_CONFIG.code,
              `pinentry failed: ${error.message}`,
              'Check pinentry installation and try again',
            ),
          );
          return;
        }

        // Parse pinentry response — look for "D <passphrase>" line
        const lines = stdout.split('\n');
        const dataLine = lines.find((l) => l.startsWith('D '));
        if (dataLine) {
          resolve(dataLine.slice(2));
          return;
        }

        // Check for cancellation
        if (
          stdout.includes('ERR 83886179') ||
          stdout.includes('Operation cancelled')
        ) {
          reject(
            new AppError(
              ERROR_CODES.USER_CANCELLED.code,
              'Passphrase entry cancelled by user',
              'Run the command again and enter your passphrase',
            ),
          );
          return;
        }

        // Empty passphrase returned (user clicked OK without typing)
        reject(
          new AppError(
            ERROR_CODES.USER_CANCELLED.code,
            'Empty passphrase provided',
            'Enter a non-empty passphrase for hidden wallet',
          ),
        );
      },
    );

    child.stdin?.write(commands);
    child.stdin?.end();
  });
}
