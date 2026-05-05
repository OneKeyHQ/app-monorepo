import {
  amountToSmallestUnit,
  buildErc20EncodedTx,
  buildNativeEncodedTx,
  estimateGasCostDisplay,
  feeToWeiHex,
  smallestUnitToDisplay,
  validateAmountDecimals,
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

  it('truncates excess decimals (internal use)', () => {
    // amountToSmallestUnit truncates for internal calculations (gas display etc.)
    // User input validation is handled by validateAmountDecimals separately
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

describe('validateAmountDecimals', () => {
  it('passes for valid precision', () => {
    expect(() => validateAmountDecimals('1.5', 18)).not.toThrow();
    expect(() => validateAmountDecimals('100', 18)).not.toThrow();
    expect(() => validateAmountDecimals('0.123456', 6)).not.toThrow();
  });

  it('rejects excess decimals for 18-decimal token', () => {
    expect(() => validateAmountDecimals('0.1234567890123456789', 18)).toThrow(
      'decimal places',
    );
  });

  it('rejects excess decimals for 6-decimal token (USDC)', () => {
    expect(() => validateAmountDecimals('1.1234567', 6)).toThrow(
      'decimal places',
    );
  });

  it('passes at exact decimal limit', () => {
    expect(() => validateAmountDecimals('0.123456', 6)).not.toThrow();
  });
});

describe('estimateGasCostDisplay', () => {
  it('calculates with Gwei gas prices (feeDecimals=9)', () => {
    // gasLimit=21000, gasPrice=20 Gwei → cost=420000 Gwei → 0.00042 ETH
    const result = estimateGasCostDisplay('21000', '20', 9, 'ETH', 18);
    expect(result).toBe('0.00042 ETH');
  });

  it('handles decimal gasPrice in Gwei', () => {
    // gasLimit=21000, gasPrice=0.055 Gwei
    const result = estimateGasCostDisplay('21000', '0.055', 9, 'BNB', 18);
    expect(result).toContain('BNB');
    expect(result).not.toBe('unknown BNB');
  });

  it('handles Base-like small gas prices', () => {
    // gasLimit=25464, gasPrice=0.00723 Gwei
    const result = estimateGasCostDisplay('25464', '0.00723', 9, 'ETH', 18);
    expect(result).toContain('ETH');
    expect(result).not.toBe('0 ETH');
  });

  it('returns unknown for NaN inputs', () => {
    expect(estimateGasCostDisplay('abc', '100', 9, 'ETH', 18)).toBe(
      'unknown ETH',
    );
    expect(estimateGasCostDisplay('21000', 'xyz', 9, 'ETH', 18)).toBe(
      'unknown ETH',
    );
  });

  it('handles zero gasPrice', () => {
    expect(estimateGasCostDisplay('21000', '0', 9, 'ETH', 18)).toBe('0 ETH');
  });
});

describe('feeToWeiHex', () => {
  it('converts Gwei to wei hex (feeDecimals=9)', () => {
    // 20 Gwei = 20_000_000_000 wei = 0x4A817C800
    expect(feeToWeiHex('20', 9)).toBe('0x4a817c800');
  });

  it('converts decimal Gwei to wei hex', () => {
    // 0.055 Gwei = 55_000_000 wei = 0x3473BC0
    expect(feeToWeiHex('0.055', 9)).toBe('0x3473bc0');
  });

  it('converts zero', () => {
    expect(feeToWeiHex('0', 9)).toBe('0x0');
  });

  it('converts with feeDecimals=18 (already wei)', () => {
    expect(feeToWeiHex('1', 18)).toBe('0xde0b6b3a7640000');
  });

  it('accepts gas price with exactly feeDecimals precision', () => {
    expect(() => feeToWeiHex('1.123456789', 9)).not.toThrow();
    expect(feeToWeiHex('1.123456789', 9)).toMatch(/^0x[0-9a-f]+$/);
  });

  it('accepts gas price with fewer than feeDecimals decimal places', () => {
    expect(() => feeToWeiHex('1.5', 9)).not.toThrow();
  });

  it('explicitly truncates excess precision (real-world Sepolia gas price)', () => {
    // API returns 10 decimal places, feeDecimals=9 — must not throw;
    // excess digit is sub-wei and has no effect on the signed fee.
    expect(() => feeToWeiHex('0.0016863484', 9)).not.toThrow();
    // 0.001686348 Gwei (truncated) = 1_686_348 wei
    expect(feeToWeiHex('0.0016863484', 9)).toBe(feeToWeiHex('0.001686348', 9));
  });

  it('truncation is deterministic for feeDecimals=6 excess precision', () => {
    // 0.1234567 truncated to 6 dp = 0.123456
    expect(feeToWeiHex('0.1234567', 6)).toBe(feeToWeiHex('0.123456', 6));
  });
});

describe('buildNativeEncodedTx', () => {
  it('builds correct native transfer tx', () => {
    const tx = buildNativeEncodedTx('0xaaa', '0xbbb', '1', 18);
    expect(tx.from).toBe('0xaaa');
    expect(tx.to).toBe('0xbbb');
    // 1 ETH = 0xde0b6b3a7640000
    expect(tx.value).toBe('0xde0b6b3a7640000');
  });

  it('builds correct tx for small amount', () => {
    const tx = buildNativeEncodedTx('0xaaa', '0xbbb', '0.001', 18);
    // 0.001 ETH = 1000000000000000 = 0x38d7ea4c68000
    expect(tx.value).toBe('0x38d7ea4c68000');
  });

  it('builds correct tx for zero', () => {
    const tx = buildNativeEncodedTx('0xaaa', '0xbbb', '0', 18);
    expect(tx.value).toBe('0x0');
  });
});

describe('buildErc20EncodedTx', () => {
  it('builds correct ERC-20 transfer calldata with 18 decimals', () => {
    const tx = buildErc20EncodedTx(
      '0xfrom',
      '0x0000000000000000000000000000000000000001',
      '1',
      '0xTokenContract',
      18,
    );
    expect(tx.from).toBe('0xfrom');
    expect(tx.to).toBe('0xTokenContract');
    expect(tx.value).toBe('0x0');
    expect(tx.data).toMatch(/^0xa9059cbb/);
    expect(tx.data.length).toBe(2 + 8 + 64 + 64);
  });

  it('encodes 6-decimal token correctly (USDC)', () => {
    const tx = buildErc20EncodedTx(
      '0xfrom',
      '0x0000000000000000000000000000000000000001',
      '1',
      '0xUSDC',
      6,
    );
    // 1 USDC = 1_000_000 = 0xF4240
    const amountHex = tx.data.slice(74);
    expect(BigInt(`0x${amountHex}`)).toBe(1_000_000n);
  });

  it('pads address correctly', () => {
    const tx = buildErc20EncodedTx(
      '0xfrom',
      '0x0000000000000000000000000000000000000001',
      '1',
      '0xToken',
      18,
    );
    // address portion: 40-char address without 0x, padded to 64
    const addressPart = tx.data.slice(10, 74);
    expect(addressPart).toBe(
      '0000000000000000000000000000000000000000000000000000000000000001',
    );
  });
});
