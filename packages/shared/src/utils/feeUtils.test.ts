import { calculateFeeForSend, calculateTotalFeeNative } from './feeUtils';

import type { IFeeInfoUnit } from '../../types/fee';

/*
yarn jest packages/shared/src/utils/feeUtils.test.ts
*/

const osmosisCommon: IFeeInfoUnit['common'] = {
  feeDecimals: 6,
  feeSymbol: 'OSMO',
  nativeDecimals: 6,
  nativeSymbol: 'OSMO',
};

const ethereumCommon: IFeeInfoUnit['common'] = {
  feeDecimals: 9,
  feeSymbol: 'Gwei',
  nativeDecimals: 18,
  nativeSymbol: 'ETH',
};

describe('calculateTotalFeeNative', () => {
  it('rounds fractional base units up to what the chain charges (OK-61701)', () => {
    // 1,247,032 gas × 0.0025 uosmo/gas = 3117.58 uosmo → 3118 uosmo on chain
    expect(
      calculateTotalFeeNative({
        amount: '0.00311758',
        feeInfo: { common: osmosisCommon },
      }),
    ).toBe('0.003118');
  });

  it('keeps integral base units unchanged', () => {
    expect(
      calculateTotalFeeNative({
        amount: '0.003118',
        feeInfo: { common: osmosisCommon },
      }),
    ).toBe('0.003118');
    // 21,000 gas × 20 gwei = 420,000 gwei = 0.00042 ETH
    expect(
      calculateTotalFeeNative({
        amount: '420000',
        feeInfo: { common: ethereumCommon },
      }),
    ).toBe('0.00042');
    expect(
      calculateTotalFeeNative({
        amount: '0',
        feeInfo: { common: osmosisCommon },
      }),
    ).toBe('0');
  });

  it('adds baseFee before rounding', () => {
    // 0.5 + 0.7 base units = 1.2 → 2 base units
    expect(
      calculateTotalFeeNative({
        amount: '0.0000005',
        feeInfo: { common: { ...osmosisCommon, baseFee: '0.0000007' } },
      }),
    ).toBe('0.000002');
    expect(
      calculateTotalFeeNative({
        amount: '0.0000005',
        feeInfo: { common: { ...osmosisCommon, baseFee: '0.0000007' } },
        withoutBaseFee: true,
      }),
    ).toBe('0.000001');
  });
});

describe('calculateFeeForSend', () => {
  it('reports the on-chain Cosmos fee for display, fiat and balance checks', () => {
    const feeInfo: IFeeInfoUnit = {
      common: osmosisCommon,
      gas: { gasPrice: '0.0000000025', gasLimit: '1247032' },
    };
    const result = calculateFeeForSend({ feeInfo, nativeTokenPrice: 2 });
    expect(result.totalNative).toBe('0.003118');
    expect(result.totalNativeMin).toBe('0.003118');
    expect(result.totalNativeForDisplay).toBe('0.003118');
    expect(result.totalNativeMinForDisplay).toBe('0.003118');
    expect(result.totalFiat).toBe('0.006236');
    expect(result.totalFiatForDisplay).toBe('0.006236');
  });

  it('leaves EVM legacy fees untouched', () => {
    const feeInfo: IFeeInfoUnit = {
      common: ethereumCommon,
      gas: { gasPrice: '20', gasLimit: '21000' },
    };
    const result = calculateFeeForSend({ feeInfo, nativeTokenPrice: 1000 });
    expect(result.totalNative).toBe('0.00042');
    expect(result.totalFiat).toBe('0.42');
  });
});
