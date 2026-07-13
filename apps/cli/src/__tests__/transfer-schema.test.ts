import { registerTransferCommand } from '../commands/transfer';
import { transferOptionsSchema } from '../schemas/transfer-schema';

import { createTestProgram, extractJson, runCommand } from './test-helpers';

jest.mock('../commands/command-guards', () => {
  const actual = jest.requireActual<
    typeof import('../commands/command-guards')
  >('../commands/command-guards');
  return {
    ...actual,
    requireAuthenticatedCommand: jest.fn(async () => undefined),
  };
});

describe('transferOptionsSchema', () => {
  const validBase = {
    to: '0x0000000000000000000000000000000000000001',
    amount: '0.001',
  };

  it('accepts valid input', () => {
    const result = transferOptionsSchema.parse(validBase);
    expect(result.to).toBe(validBase.to);
    expect(result.amount).toBe('0.001');
  });

  it('accepts with all optional fields', () => {
    const result = transferOptionsSchema.parse({
      ...validBase,
      chain: 'bsc',
      token: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      dryRun: true,
      yes: true,
    });
    expect(result.chain).toBe('bsc');
    expect(result.dryRun).toBe(true);
  });

  // Recipient validation is chain-aware in the command path.
  it('accepts chain-specific recipient strings at schema level', () => {
    const result = transferOptionsSchema.parse({
      to: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      amount: '0.00001',
      chain: 'tbtc',
    });

    expect(result.to).toBe('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
  });

  it('still rejects non-EVM recipients on default EVM transfer path', async () => {
    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      'transfer',
      '--to',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--amount',
      '0.00001',
      '--dry-run',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_INVALID_ADDRESS');
  });

  // Amount validation
  it('accepts whole number amount', () => {
    expect(
      transferOptionsSchema.parse({ ...validBase, amount: '100' }).amount,
    ).toBe('100');
  });

  it('accepts decimal amount', () => {
    expect(
      transferOptionsSchema.parse({ ...validBase, amount: '0.5' }).amount,
    ).toBe('0.5');
  });

  it('rejects negative amount', () => {
    expect(() =>
      transferOptionsSchema.parse({ ...validBase, amount: '-1' }),
    ).toThrow('Amount must be a positive number');
  });

  it('rejects non-numeric amount', () => {
    expect(() =>
      transferOptionsSchema.parse({ ...validBase, amount: 'abc' }),
    ).toThrow('Amount must be a positive number');
  });

  it('rejects empty amount', () => {
    expect(() =>
      transferOptionsSchema.parse({ ...validBase, amount: '' }),
    ).toThrow('Amount must be a positive number');
  });

  // Token validation is chain-aware in the command path (asserted after
  // resolveChain). The schema only enforces non-empty string so SPL mints
  // and other chain-specific token IDs reach the per-chain validator.
  it('accepts chain-agnostic token strings at schema level', () => {
    const result = transferOptionsSchema.parse({
      ...validBase,
      chain: 'sol',
      token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    });
    expect(result.token).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('rejects empty token at schema level', () => {
    const result = transferOptionsSchema.safeParse({ ...validBase, token: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid EVM token format on default EVM transfer path', async () => {
    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      'transfer',
      '--to',
      '0x0000000000000000000000000000000000000001',
      '--amount',
      '0.001',
      '--token',
      'not-an-address',
      '--dry-run',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_INVALID_TOKEN');
  });

  it('rejects invalid SPL mint format on SOL transfer path', async () => {
    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      'transfer',
      '--chain',
      'sol',
      '--to',
      '11111111111111111111111111111111',
      '--amount',
      '0.001',
      '--token',
      'not-a-mint',
      '--dry-run',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_INVALID_TOKEN');
  });

  it('parses BTC address type', () => {
    const result = transferOptionsSchema.parse({
      ...validBase,
      chain: 'tbtc',
      addressType: 'taproot',
    });

    expect(result.addressType).toBe('taproot');
  });

  it('rejects invalid BTC address type', () => {
    const result = transferOptionsSchema.safeParse({
      ...validBase,
      chain: 'tbtc',
      addressType: 'segwit',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['addressType']);
    }
  });
});
