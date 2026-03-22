import { transferOptionsSchema } from '../schemas/transfer-schema';

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

  // Address validation
  it('rejects short address', () => {
    expect(() =>
      transferOptionsSchema.parse({ ...validBase, to: '0x123' }),
    ).toThrow('Invalid Ethereum address');
  });

  it('rejects address without 0x prefix', () => {
    expect(() =>
      transferOptionsSchema.parse({
        ...validBase,
        to: '0000000000000000000000000000000000000001',
      }),
    ).toThrow('Invalid Ethereum address');
  });

  it('rejects address with invalid hex chars', () => {
    expect(() =>
      transferOptionsSchema.parse({
        ...validBase,
        to: '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      }),
    ).toThrow('Invalid Ethereum address');
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

  // Token address validation
  it('rejects invalid token address', () => {
    expect(() =>
      transferOptionsSchema.parse({ ...validBase, token: 'not-an-address' }),
    ).toThrow('Invalid Ethereum address');
  });
});
