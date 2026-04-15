import { createInterface } from 'node:readline';

type IAuthLoginMethodSelection = 'mnemonic' | 'app_transfer';

export function readHiddenInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    (
      rl as unknown as { _writeToOutput: (value: string) => void }
    )._writeToOutput = (value: string) => {
      if (value.includes(prompt)) {
        process.stderr.write(value);
      }
    };
    rl.question(prompt, (answer) => {
      process.stderr.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

export function readConfirmation(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function readStdinPipe(): Promise<string> {
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

export async function readMnemonicInput(
  prompt: string = 'Enter BIP39 mnemonic: ',
): Promise<string> {
  if (process.stdin.isTTY) {
    return readHiddenInput(prompt);
  }

  return readStdinPipe();
}

export function promptForAuthLoginMethod(): Promise<IAuthLoginMethodSelection> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    const prompt = () => {
      process.stderr.write(
        [
          'Select login method:',
          '  1. Import mnemonic',
          '  2. Import from OneKey App',
        ].join('\n'),
      );
      process.stderr.write('\n');

      rl.question('Enter selection [1/2]: ', (answer) => {
        const normalized = answer.trim();
        if (normalized === '1') {
          rl.close();
          resolve('mnemonic');
          return;
        }

        if (normalized === '2') {
          rl.close();
          resolve('app_transfer');
          return;
        }

        process.stderr.write('Invalid selection. Enter 1 or 2.\n');
        prompt();
      });
    };

    prompt();
  });
}

export type { IAuthLoginMethodSelection as AuthLoginMethodSelection };
