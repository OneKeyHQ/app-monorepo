import BigNumber from 'bignumber.js';

import { ELightningUnit } from '../../types/lightning';

import chainValueUtils from './chainValueUtils';

/*
yarn test packages/shared/src/utils/chainValueUtils.test.ts
*/

const mockNetwork = {
  id: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  decimals: 18,
  feeMeta: {
    decimals: 9, // Gwei
  },
};

const mockToken = {
  id: 'token-1',
  name: 'Test Token',
  symbol: 'TEST',
  decimals: 6,
};

describe('chainValueUtils', () => {
  describe('convertChainValueToGwei', () => {
    it('should convert chain value to Gwei', () => {
      const result = chainValueUtils.convertChainValueToGwei({
        value: '1000000000', // 1 Gwei in wei
        network: mockNetwork,
      });
      expect(result).toBe('1');
    });

    it('should handle large values', () => {
      const result = chainValueUtils.convertChainValueToGwei({
        value: '1000000000000000000', // 1 ETH in wei
        network: mockNetwork,
      });
      expect(result).toBe('1000000000'); // 1 ETH = 1e9 Gwei
    });

    it('should handle BigNumber input', () => {
      const result = chainValueUtils.convertChainValueToGwei({
        value: new BigNumber('1000000000'),
        network: mockNetwork,
      });
      expect(result).toBe('1');
    });

    it('should throw error when feeMeta.decimals is missing', () => {
      const invalidNetwork = { ...mockNetwork, feeMeta: {} };
      expect(() =>
        chainValueUtils.convertChainValueToGwei({
          value: '1000',
          network: invalidNetwork,
        }),
      ).toThrow();
    });
  });

  describe('convertGweiToChainValue', () => {
    it('should convert Gwei to chain value', () => {
      const result = chainValueUtils.convertGweiToChainValue({
        value: '1',
        network: mockNetwork,
      });
      expect(result).toBe('1000000000'); // 1 Gwei = 1e9 wei
    });

    it('should handle large Gwei values', () => {
      const result = chainValueUtils.convertGweiToChainValue({
        value: '1000000000', // 1 ETH in Gwei
        network: mockNetwork,
      });
      expect(result).toBe('1000000000000000000'); // 1 ETH in wei
    });

    it('should throw error when feeMeta.decimals is missing', () => {
      const invalidNetwork = { ...mockNetwork, feeMeta: {} };
      expect(() =>
        chainValueUtils.convertGweiToChainValue({
          value: '1',
          network: invalidNetwork,
        }),
      ).toThrow();
    });
  });

  describe('convertChainValueToAmount', () => {
    it('should convert chain value to amount', () => {
      const result = chainValueUtils.convertChainValueToAmount({
        value: '1000000000000000000', // 1 ETH in wei
        network: mockNetwork,
      });
      expect(result).toBe('1');
    });

    it('should handle fractional amounts', () => {
      const result = chainValueUtils.convertChainValueToAmount({
        value: '500000000000000000', // 0.5 ETH in wei
        network: mockNetwork,
      });
      expect(result).toBe('0.5');
    });

    it('should throw error when decimals is missing', () => {
      const invalidNetwork = { ...mockNetwork, decimals: undefined };
      expect(() =>
        chainValueUtils.convertChainValueToAmount({
          value: '1000',
          network: invalidNetwork,
        }),
      ).toThrow();
    });
  });

  describe('convertAmountToChainValue', () => {
    it('should convert amount to chain value', () => {
      const result = chainValueUtils.convertAmountToChainValue({
        value: '1',
        network: mockNetwork,
      });
      expect(result).toBe('1000000000000000000'); // 1 ETH in wei
    });

    it('should handle fractional amounts', () => {
      const result = chainValueUtils.convertAmountToChainValue({
        value: '0.5',
        network: mockNetwork,
      });
      expect(result).toBe('500000000000000000'); // 0.5 ETH in wei
    });

    it('should throw error when decimals is missing', () => {
      const invalidNetwork = { ...mockNetwork, decimals: undefined };
      expect(() =>
        chainValueUtils.convertAmountToChainValue({
          value: '1',
          network: invalidNetwork,
        }),
      ).toThrow();
    });
  });

  describe('convertGweiToAmount', () => {
    it('should convert Gwei to amount', () => {
      const result = chainValueUtils.convertGweiToAmount({
        value: '1000000000', // 1 ETH in Gwei
        network: mockNetwork,
      });
      expect(result).toBe('1');
    });

    it('should handle fractional Gwei', () => {
      const result = chainValueUtils.convertGweiToAmount({
        value: '500000000', // 0.5 ETH in Gwei
        network: mockNetwork,
      });
      expect(result).toBe('0.5');
    });
  });

  describe('convertAmountToGwei', () => {
    it('should convert amount to Gwei', () => {
      const result = chainValueUtils.convertAmountToGwei({
        value: '1',
        network: mockNetwork,
      });
      expect(result).toBe('1000000000'); // 1 ETH in Gwei
    });

    it('should handle fractional amounts', () => {
      const result = chainValueUtils.convertAmountToGwei({
        value: '0.5',
        network: mockNetwork,
      });
      expect(result).toBe('500000000'); // 0.5 ETH in Gwei
    });
  });

  describe('convertTokenChainValueToAmount', () => {
    it('should convert token chain value to amount', () => {
      const result = chainValueUtils.convertTokenChainValueToAmount({
        value: '1000000', // 1 token with 6 decimals
        token: mockToken,
      });
      expect(result).toBe('1');
    });

    it('should handle fractional token amounts', () => {
      const result = chainValueUtils.convertTokenChainValueToAmount({
        value: '500000', // 0.5 token
        token: mockToken,
      });
      expect(result).toBe('0.5');
    });

    it('should throw error when token decimals is missing', () => {
      const invalidToken = { ...mockToken, decimals: undefined };
      expect(() =>
        chainValueUtils.convertTokenChainValueToAmount({
          value: '1000',
          token: invalidToken,
        }),
      ).toThrow();
    });
  });

  describe('convertTokenAmountToChainValue', () => {
    it('should convert token amount to chain value', () => {
      const result = chainValueUtils.convertTokenAmountToChainValue({
        value: '1',
        token: mockToken,
      });
      expect(result).toBe('1000000'); // 1 token with 6 decimals
    });

    it('should handle fractional amounts', () => {
      const result = chainValueUtils.convertTokenAmountToChainValue({
        value: '0.5',
        token: mockToken,
      });
      expect(result).toBe('500000');
    });

    it('should handle decimal places and rounding mode', () => {
      const result = chainValueUtils.convertTokenAmountToChainValue({
        value: '1.123456789',
        token: mockToken,
        decimalPlaces: 2,
        roundingMode: BigNumber.ROUND_DOWN,
      });
      expect(result).toBe('1123400');
    });

    it('should throw error when token decimals is missing', () => {
      const invalidToken = { ...mockToken, decimals: undefined };
      expect(() =>
        chainValueUtils.convertTokenAmountToChainValue({
          value: '1',
          token: invalidToken,
        }),
      ).toThrow();
    });
  });

  describe('fixNativeTokenMaxSendAmount', () => {
    it('should fix max send amount with proper precision', () => {
      const result = chainValueUtils.fixNativeTokenMaxSendAmount({
        amount: '1.123456789012345678',
        network: mockNetwork,
      });
      expect(result).toBe('1.12345678901234');
    });

    it('should handle BigNumber input', () => {
      const result = chainValueUtils.fixNativeTokenMaxSendAmount({
        amount: new BigNumber('1.123456789012345678'),
        network: mockNetwork,
      });
      expect(result).toBe('1.12345678901234');
    });

    it('should round down correctly', () => {
      const result = chainValueUtils.fixNativeTokenMaxSendAmount({
        amount: '0.999999999999999999',
        network: mockNetwork,
      });
      // decimals - 2 = 16 decimal places
      expect(result).toBe('0.9999999999999999');
    });
  });

  describe('convertBtcToSats', () => {
    it('should convert BTC to sats', () => {
      const result = chainValueUtils.convertBtcToSats('1');
      expect(result).toBe('100000000');
    });

    it('should convert fractional BTC', () => {
      const result = chainValueUtils.convertBtcToSats('0.5');
      expect(result).toBe('50000000');
    });

    it('should handle number input', () => {
      const result = chainValueUtils.convertBtcToSats(1);
      expect(result).toBe('100000000');
    });

    it('should return empty string for empty input', () => {
      expect(chainValueUtils.convertBtcToSats('')).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(chainValueUtils.convertBtcToSats(undefined as any)).toBe('');
    });

    it('should return 0 for invalid input', () => {
      expect(chainValueUtils.convertBtcToSats('invalid')).toBe('0');
    });
  });

  describe('convertSatsToBtc', () => {
    it('should convert sats to BTC', () => {
      const result = chainValueUtils.convertSatsToBtc('100000000');
      expect(result).toBe('1');
    });

    it('should convert fractional sats', () => {
      const result = chainValueUtils.convertSatsToBtc('50000000');
      expect(result).toBe('0.5');
    });

    it('should handle number input', () => {
      const result = chainValueUtils.convertSatsToBtc(100000000);
      expect(result).toBe('1');
    });

    it('should return empty string for empty input', () => {
      expect(chainValueUtils.convertSatsToBtc('')).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(chainValueUtils.convertSatsToBtc(undefined as any)).toBe('');
    });

    it('should return 0 for invalid input', () => {
      expect(chainValueUtils.convertSatsToBtc('invalid')).toBe('0');
    });
  });

  describe('getLightningAmountDecimals', () => {
    it('should return 8 for BTC unit', () => {
      const result = chainValueUtils.getLightningAmountDecimals({
        lnUnit: ELightningUnit.BTC,
        decimals: 6,
      });
      expect(result).toBe(8); // log10(100000000) = 8
    });

    it('should return provided decimals for SATS unit', () => {
      const result = chainValueUtils.getLightningAmountDecimals({
        lnUnit: ELightningUnit.SATS,
        decimals: 6,
      });
      expect(result).toBe(6);
    });

    it('should handle different decimal values', () => {
      const result = chainValueUtils.getLightningAmountDecimals({
        lnUnit: ELightningUnit.SATS,
        decimals: 18,
      });
      expect(result).toBe(18);
    });
  });
});
