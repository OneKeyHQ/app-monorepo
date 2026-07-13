import { registerSecurityCommands } from '../commands/security';
import { registerTransferCommand } from '../commands/transfer';

import { createTestProgram, runCommand } from './test-helpers';

jest.mock('../commands/command-guards', () => {
  const actual = jest.requireActual<
    typeof import('../commands/command-guards')
  >('../commands/command-guards');
  return {
    ...actual,
    requireAuthenticatedCommand: jest.fn(async () => undefined),
  };
});

describe('BTC unsupported command gates', () => {
  it('requires explicit tbtc address type before tx construction', async () => {
    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      'transfer',
      '--chain',
      'tbtc',
      '--to',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--amount',
      '0.00001',
      '--dry-run',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('PARAM_MISSING_REQUIRED');
    expect(result.stdout).toContain('--address-type');
  });

  it('rejects tbtc security simulation explicitly', async () => {
    const program = createTestProgram();
    registerSecurityCommands(program);

    const result = await runCommand(program, [
      'security',
      'simulate',
      '--chain',
      'tbtc',
      '--to',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--data',
      '0x',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain('does not support chain');
    expect(result.stdout).toContain('security-simulate');
  });
});
