import { createInterface } from 'node:readline';

import { AppError, ERROR_CODES } from '../errors';

import type { OutputFormatter } from '../output';

export interface ITxConfirmationInfo {
  action: string;
  to: string;
  value?: string;
  network: string;
  estimatedGas?: string;
}

function readConfirmation(prompt: string): Promise<boolean> {
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

export async function confirmTransaction(params: {
  info: ITxConfirmationInfo;
  output: OutputFormatter;
  skipConfirmation: boolean;
}): Promise<void> {
  const { info, output, skipConfirmation } = params;

  if (skipConfirmation) return;

  // Non-interactive modes (--json, --quiet) cannot prompt — require --yes
  if (output.getMode() !== 'human') {
    throw new AppError(
      ERROR_CODES.USER_CANCELLED.code,
      'Transaction requires confirmation. Pass --yes to authorize.',
      'Run with --yes to skip confirmation in non-interactive mode',
    );
  }

  const lines = [
    '\u26A0 Transaction Summary',
    `  Action:  ${info.action}`,
    `  To:      ${info.to}`,
  ];
  if (info.value !== undefined) {
    lines.push(`  Value:   ${info.value}`);
  }
  lines.push(`  Network: ${info.network}`);
  if (info.estimatedGas !== undefined) {
    lines.push(`  Gas:     ${info.estimatedGas}`);
  }
  lines.push('');

  process.stderr.write(`${lines.join('\n')}\n`);

  const confirmed = await readConfirmation('Proceed? (y/N): ');
  if (!confirmed) {
    throw new AppError(
      ERROR_CODES.USER_CANCELLED.code,
      'Transaction cancelled by user',
      'Run with --yes to skip confirmation',
    );
  }
}
