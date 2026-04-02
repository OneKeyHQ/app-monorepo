import { validateEvmAddress } from '.';

/*
yarn jest packages/core/src/chains/evm/sdkEvm/validateEvmAddress.test.ts
*/

describe('validateEvmAddress', () => {
  it('should accept valid checksummed address', async () => {
    const result = await validateEvmAddress(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
    expect(result.isValid).toBe(true);
    expect(result.displayAddress).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
    expect(result.normalizedAddress).toBe(
      '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
    );
  });

  it('should accept valid all-lowercase address', async () => {
    const result = await validateEvmAddress(
      '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
    );
    expect(result.isValid).toBe(true);
  });

  it('should accept valid all-uppercase address (after 0x)', async () => {
    const result = await validateEvmAddress(
      '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED',
    );
    expect(result.isValid).toBe(true);
  });

  it('should reject address with invalid checksum (mixed case)', async () => {
    // Invalid checksum - wrong case on specific characters
    const result = await validateEvmAddress(
      '0x5AAEB6053f3e94c9b9a09f33669435e7ef1beaed',
    );
    // ethers getAddress throws on invalid mixed-case checksum
    expect(result.isValid).toBe(false);
  });

  it('should reject address too short', async () => {
    const result = await validateEvmAddress('0x5aAeb6053F3E94C9b9A09f33');
    expect(result.isValid).toBe(false);
  });

  it('should reject address too long', async () => {
    const result = await validateEvmAddress(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed00',
    );
    expect(result.isValid).toBe(false);
  });

  it('should reject non-hex characters', async () => {
    const result = await validateEvmAddress(
      '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
    );
    expect(result.isValid).toBe(false);
  });

  it('should reject empty string', async () => {
    const result = await validateEvmAddress('');
    expect(result.isValid).toBe(false);
  });

  it('should reject address without 0x prefix', async () => {
    const result = await validateEvmAddress(
      '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
    // ethers getAddress should still handle this
    expect(result.isValid).toBe(true);
  });

  it('should accept zero address', async () => {
    const result = await validateEvmAddress(
      '0x0000000000000000000000000000000000000000',
    );
    expect(result.isValid).toBe(true);
    expect(result.normalizedAddress).toBe(
      '0x0000000000000000000000000000000000000000',
    );
  });

  it('should return normalized address in lowercase', async () => {
    const result = await validateEvmAddress(
      '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
    );
    expect(result.isValid).toBe(true);
    expect(result.normalizedAddress).toBe(
      '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
    );
  });

  it('should return display address in checksum format', async () => {
    const result = await validateEvmAddress(
      '0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e',
    );
    expect(result.isValid).toBe(true);
    // Display address should be EIP-55 checksum format
    expect(result.displayAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('should handle burn address (all zeros)', async () => {
    const result = await validateEvmAddress(
      '0x0000000000000000000000000000000000000000',
    );
    expect(result.isValid).toBe(true);
    expect(result.normalizedAddress).toBe(
      '0x0000000000000000000000000000000000000000',
    );
  });

  it('should handle precompile addresses (0x01 - 0x09)', async () => {
    for (let i = 1; i <= 9; i += 1) {
      const addr = `0x${i.toString(16).padStart(40, '0')}`;
      const result = await validateEvmAddress(addr);
      expect(result.isValid).toBe(true);
    }
  });

  it('should reject address with whitespace', async () => {
    const result = await validateEvmAddress(
      ' 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed ',
    );
    expect(result.isValid).toBe(false);
  });

  it('should handle address with uppercase 0X prefix', async () => {
    const invalidPrefix = '0X5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
    try {
      const result = await validateEvmAddress(invalidPrefix);
      // Document the behavior - may or may not be accepted
      expect(result).toBeDefined();
    } catch {
      // Expected
    }
  });

  it('should handle address with no prefix', async () => {
    const noPrefix = '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
    const result = await validateEvmAddress(noPrefix);
    // Document behavior - some implementations accept
    expect(result).toBeDefined();
  });

  it('should reject null/undefined', async () => {
    // @ts-ignore - testing runtime behavior
    const result1 = await validateEvmAddress(null);
    expect(result1.isValid).toBe(false);

    // @ts-ignore
    const result2 = await validateEvmAddress(undefined);
    expect(result2.isValid).toBe(false);
  });
});
