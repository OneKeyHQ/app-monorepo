/**
 * Secure passphrase input via the system pinentry program
 * (pinentry-mac / pinentry / pinentry-gnome3 / pinentry-qt).
 *
 * The passphrase is entered in an OS dialog and returned as a string —
 * it never appears in the terminal, shell history, process arguments,
 * or env vars. We pipe commands over stdin so the dialog configuration
 * (description, prompt) doesn't show up in argv either.
 */

import { execFile } from 'node:child_process';

import { AppError, ERROR_CODES } from '../errors';

const PINENTRY_PROGRAMS = [
  'pinentry-mac',
  'pinentry',
  'pinentry-gnome3',
  'pinentry-qt',
];

// Assuan protocol percent-encodes %, CR, and LF in D data lines.
// Without decoding, a passphrase containing `%` would be silently corrupted
// (e.g. `a%b` → `a%25b`), deriving a wrong passphraseState and exposing a
// different — empty — hidden wallet.
export function decodeAssuanData(encoded: string): string {
  return encoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

// Parse pinentry stdout into either a passphrase or a cancellation signal.
// Handles two edge cases beyond the basic `D <data>` shape:
//   1. Multi-line D responses — long passphrases past Assuan's ~1000-byte
//      line limit get split across several `D` lines and must be concatenated
//      *before* percent-decoding (a split inside `%XX` would otherwise corrupt
//      the byte).
//   2. CRLF line endings — pinentry-mac uses LF, but pinentry-gnome3/qt may
//      emit CRLF; splitting on `\r?\n` strips the trailing CR that would
//      otherwise become a literal trailing byte in the passphrase.
export function parsePinentryStdout(stdout: string): {
  data?: string;
  cancelled: boolean;
} {
  // Pinentry error code 83886179 is the canonical "user cancelled" signal —
  // surfaces either as a non-zero exit or as an ERR line.
  const cancelled =
    stdout.includes('ERR 83886179') || stdout.includes('Operation cancelled');

  const dataChunks = stdout
    .split(/\r?\n/)
    .filter((l) => l.startsWith('D '))
    .map((l) => l.slice(2));

  if (dataChunks.length > 0) {
    return { data: decodeAssuanData(dataChunks.join('')), cancelled };
  }
  return { cancelled };
}

function findPinentry(): string | null {
  for (const prog of PINENTRY_PROGRAMS) {
    try {
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
      // Program not found — try the next one.
    }
  }
  return null;
}

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
        const { data, cancelled } = parsePinentryStdout(stdout);

        if (error) {
          if (error.killed || cancelled) {
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

        if (data !== undefined) {
          resolve(data);
          return;
        }

        if (cancelled) {
          reject(
            new AppError(
              ERROR_CODES.USER_CANCELLED.code,
              'Passphrase entry cancelled by user',
              'Run the command again and enter your passphrase',
            ),
          );
          return;
        }

        // User clicked OK without typing anything.
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
