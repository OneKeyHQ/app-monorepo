import BigNumber from 'bignumber.js';

import {
  calculateSolTotalFee,
  nanToZeroString,
  presetFeeList,
} from './feeUtils';

describe('feeUtils', () => {
  describe('nanToZeroString', () => {
    it('should convert NaN string to zero', () => {
      expect(nanToZeroString('NaN')).toBe('0');
    });

    it('should convert NaN number to zero', () => {
      expect(nanToZeroString(NaN)).toBe('0');
    });

    it('should return valid string as is', () => {
      expect(nanToZeroString('100')).toBe('100');
    });

    it('should return valid number as is', () => {
      expect(nanToZeroString(100)).toBe(100);
    });
  });

  describe('calculateSolTotalFee', () => {
    it('should calculate Solana fee correctly', () => {
      const result = calculateSolTotalFee({
        computeUnitPrice: '1000',
        computeUnitLimit: '200000',
        computeUnitPriceDecimals: 6,
        baseFee: '5000',
        feeInfo: {
          common: { feeDecimals: 9 },
        } as any,
      });
      // (1000 * 200000 / 10^6 + 5000) / 10^9 = 0.000205 SOL
      expect(result.toString()).toBe('0.000205');
    });

    it('should handle BigNumber inputs', () => {
      const result = calculateSolTotalFee({
        computeUnitPrice: new BigNumber('5000'),
        computeUnitLimit: new BigNumber('100000'),
        computeUnitPriceDecimals: new BigNumber(6),
        baseFee: new BigNumber('10000'),
        feeInfo: {
          common: { feeDecimals: 9 },
        } as any,
      });
      expect(result.toString()).toBe('0.00051');
    });
  });

  describe('presetFeeList', () => {
    it('should return array with 3 presets', () => {
      const list = presetFeeList({
        feeType: 'EIP1559',
        gas: {
          gasLimit: '21000',
          gasPrice: '1000000000',
          maxFeePerGas: '2000000000',
          maxPriorityFeePerGas: '100000000',
        },
      } as any);
      expect(list).toHaveLength(3);
      expect(list[0].icon).toBe('🐢');
      expect(list[1].icon).toBe('🚗');
      expect(list[2].icon).toBe('🚀');
    });
  });
});
