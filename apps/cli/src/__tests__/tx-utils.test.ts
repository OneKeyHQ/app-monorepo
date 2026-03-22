import {
  amountToSmallestUnit,
  buildErc20EncodedTx,
  buildNativeEncodedTx,
  estimateGasCostDisplay,
  smallestUnitToDisplay,
} from '../utils/tx-utils';

describe('amountToSmallestUnit', () => {
  it('converts whole number', () => {
    expect(amountToSmallestUnit('1', 18)).toBe('1000000000000000000');
  });

  it('converts decimal amount', () => {
    expect(amountToSmallestUnit('0.001', 18)).toBe('1000000000000000');
  });

  it('converts amount with trailing zeros', () => {
    expect(amountToSmallestUnit('1.50', 18)).toBe('1500000000000000000');
  });

  it('handles zero', () => {
    expect(amountToSmallestUnit('0', 18)).toBe('0');
  });

  it('handles 0.0', () => {
    expect(amountToSmallestUnit('0.0', 18)).toBe('0');
  });

  it('handles large amounts', () => {
    expect(amountToSmallestUnit('1000000', 18)).toBe(
      '1000000000000000000000000',
    );
  });

  it('truncates excess decimals', () => {
    // 0.1234567890123456789999 with 18 decimals → truncated to 18
    expect(amountToSmallestUnit('0.1234567890123456789999', 18)).toBe(
      '123456789012345678',
    );
  });

  it('works with non-18 decimals (e.g. USDC = 6)', () => {
    expect(amountToSmallestUnit('1.5', 6)).toBe('1500000');
  });

  it('works with 8 decimals (e.g. BTC)', () => {
    expect(amountToSmallestUnit('0.00000001', 8)).toBe('1');
  });
});

describe('smallestUnitToDisplay', () => {
  it('converts wei to ETH', () => {
    expect(smallestUnitToDisplay('1000000000000000000', 18)).toBe('1');
  });

  it('converts small wei to decimal', () => {
    expect(smallestUnitToDisplay('1000000000000000', 18)).toBe('0.001');
  });

  it('handles zero', () => {
    expect(smallestUnitToDisplay('0', 18)).toBe('0');
  });

  it('handles 1 wei', () => {
    expect(smallestUnitToDisplay('1', 18)).toBe('0.000000000000000001');
  });

  it('trims trailing zeros', () => {
    expect(smallestUnitToDisplay('1500000000000000000', 18)).toBe('1.5');
  });

  it('works with 6 decimals', () => {
    expect(smallestUnitToDisplay('1500000', 6)).toBe('1.5');
  });
});

describe('estimateGasCostDisplay', () => {
  it('calculates with integer gas values', () => {
    // 21000 * 20000000000 = 420000000000000 wei = 0.00042 ETH
    const result = estimateGasCostDisplay('21000', '20000000000', 18, 'ETH');
    expect(result).toBe('0.00042 ETH');
  });

  it('handles decimal gasPrice (the BSC bug)', () => {
    // API returns "0.055" — this was the BigInt crash
    const result = estimateGasCostDisplay('21000', '0.055', 18, 'BNB');
    expect(result).toContain('BNB');
    expect(result).not.toBe('unknown BNB');
  });

  it('handles decimal maxFeePerGas', () => {
    const result = estimateGasCostDisplay('100000', '1.5', 9, 'GWEI');
    expect(result).toContain('GWEI');
    expect(result).not.toBe('unknown GWEI');
  });

  it('returns unknown for NaN inputs', () => {
    expect(estimateGasCostDisplay('abc', '100', 18, 'ETH')).toBe('unknown ETH');
    expect(estimateGasCostDisplay('21000', 'xyz', 18, 'ETH')).toBe(
      'unknown ETH',
    );
  });

  it('handles empty string', () => {
    expect(estimateGasCostDisplay('', '100', 18, 'ETH')).toBe('0 ETH');
  });

  it('handles zero gasPrice', () => {
    expect(estimateGasCostDisplay('21000', '0', 18, 'ETH')).toBe('0 ETH');
  });
});

describe('buildNativeEncodedTx', () => {
  it('builds correct native transfer tx', () => {
    const tx = buildNativeEncodedTx('0xaaa', '0xbbb', '1');
    expect(tx.from).toBe('0xaaa');
    expect(tx.to).toBe('0xbbb');
    // 1 ETH = 0xde0b6b3a7640000
    expect(tx.value).toBe('0xde0b6b3a7640000');
  });

  it('builds correct tx for small amount', () => {
    const tx = buildNativeEncodedTx('0xaaa', '0xbbb', '0.001');
    // 0.001 ETH = 1000000000000000 = 0x38d7ea4c68000
    expect(tx.value).toBe('0x38d7ea4c68000');
  });

  it('builds correct tx for zero', () => {
    const tx = buildNativeEncodedTx('0xaaa', '0xbbb', '0');
    expect(tx.value).toBe('0x0');
  });
});

describe('buildErc20EncodedTx', () => {
  it('builds correct ERC-20 transfer calldata', () => {
    const tx = buildErc20EncodedTx(
      '0xfrom',
      '0x0000000000000000000000000000000000000001',
      '1',
      '0xTokenContract',
    );
    expect(tx.from).toBe('0xfrom');
    expect(tx.to).toBe('0xTokenContract');
    expect(tx.value).toBe('0x0');
    // Should start with transfer selector
    expect(tx.data).toMatch(/^0xa9059cbb/);
    // data = selector(8) + address(64) + amount(64) = 138 chars + 0x prefix = 140
    expect(tx.data.length).toBe(2 + 8 + 64 + 64);
  });

  it('pads address correctly', () => {
    const tx = buildErc20EncodedTx(
      '0xfrom',
      '0x0000000000000000000000000000000000000001',
      '1',
      '0xToken',
    );
    // address portion: 40-char address without 0x, padded to 64
    const addressPart = tx.data.slice(10, 74);
    expect(addressPart).toBe(
      '0000000000000000000000000000000000000000000000000000000000000001',
    );
  });
});
