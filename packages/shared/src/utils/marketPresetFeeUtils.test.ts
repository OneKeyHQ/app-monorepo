import { applyCustomPriorityFeeToGasInfo } from './marketPresetFeeUtils';

import type { IEstimateFeeParams } from '../../types/fee';
import type { ISwapGasInfo } from '../../types/swap/types';

const baseCommon: NonNullable<ISwapGasInfo['common']> = {
  feeDecimals: 9,
  feeSymbol: 'Gwei',
  nativeDecimals: 18,
  nativeSymbol: 'ETH',
};

const baseSolCommon: NonNullable<ISwapGasInfo['common']> = {
  feeDecimals: 9,
  feeSymbol: 'lamports',
  nativeDecimals: 9,
  nativeSymbol: 'SOL',
};

describe('applyCustomPriorityFeeToGasInfo', () => {
  test('returns gasInfo unchanged when customPriorityFee is undefined', () => {
    const gasInfo: ISwapGasInfo = {
      common: baseCommon,
      gasEIP1559: {
        baseFeePerGas: '5',
        maxFeePerGas: '15',
        maxPriorityFeePerGas: '2',
        gasLimit: '21000',
        gasLimitForDisplay: '21000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({ gasInfo });

    expect(result).toBe(gasInfo);
  });

  test.each([
    ['empty string', ''],
    ['NaN string', 'abc'],
    ['zero', '0'],
    ['negative', '-1'],
  ])('returns gasInfo unchanged when customValue is %s', (_, customValue) => {
    const gasInfo: ISwapGasInfo = {
      common: baseCommon,
      gasEIP1559: {
        baseFeePerGas: '5',
        maxFeePerGas: '15',
        maxPriorityFeePerGas: '2',
        gasLimit: '21000',
        gasLimitForDisplay: '21000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue },
    });

    expect(result).toBe(gasInfo);
  });

  test('applies customValue to EIP-1559 maxPriorityFeePerGas when feeDecimals matches Gwei (9)', () => {
    const gasInfo: ISwapGasInfo = {
      common: baseCommon,
      gasEIP1559: {
        baseFeePerGas: '5',
        maxFeePerGas: '15',
        maxPriorityFeePerGas: '2',
        gasLimit: '21000',
        gasLimitForDisplay: '21000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '3' },
    });

    expect(result.gasEIP1559?.maxPriorityFeePerGas).toBe('3');
    // maxFeePerGas = baseFeePerGas * 2 + maxPriorityFeePerGas = 5 * 2 + 3 = 13
    expect(result.gasEIP1559?.maxFeePerGas).toBe('13');
    expect(result.gasEIP1559?.gasLimit).toBe('21000');
  });

  test('shifts customValue when feeDecimals differs from Gwei (9)', () => {
    const gasInfo: ISwapGasInfo = {
      common: { ...baseCommon, feeDecimals: 0 },
      gasEIP1559: {
        baseFeePerGas: '0',
        maxFeePerGas: '0',
        maxPriorityFeePerGas: '0',
        gasLimit: '21000',
        gasLimitForDisplay: '21000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '3' },
    });

    // 3 Gwei in wei = 3 * 10^9 = 3000000000
    expect(result.gasEIP1559?.maxPriorityFeePerGas).toBe('3000000000');
  });

  test('applies customValue to legacy gas.gasPrice when no EIP-1559', () => {
    const gasInfo: ISwapGasInfo = {
      common: baseCommon,
      gas: {
        gasPrice: '1',
        gasLimit: '21000',
        gasLimitForDisplay: '21000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '5' },
    });

    expect(result.gas?.gasPrice).toBe('5');
  });

  test('prefers EIP-1559 branch when both gas and gasEIP1559 are present', () => {
    const gasInfo: ISwapGasInfo = {
      common: baseCommon,
      gas: { gasPrice: '1', gasLimit: '21000', gasLimitForDisplay: '21000' },
      gasEIP1559: {
        baseFeePerGas: '5',
        maxFeePerGas: '15',
        maxPriorityFeePerGas: '2',
        gasLimit: '21000',
        gasLimitForDisplay: '21000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '3' },
    });

    expect(result.gasEIP1559?.maxPriorityFeePerGas).toBe('3');
    expect(result.gas?.gasPrice).toBe('1');
  });

  test('applies customValue to Solana feeSol.computeUnitPrice with formula', () => {
    const gasInfo: ISwapGasInfo = {
      common: baseSolCommon,
      feeSol: { computeUnitPrice: '0' },
    };
    const estimateFeeParams: IEstimateFeeParams = {
      estimateFeeParamsSol: {
        computeUnitLimit: '200000',
        computeUnitPriceDecimals: 6,
        baseFee: '5000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '0.001' },
      estimateFeeParams,
    });

    // 0.001 SOL * 10^9 (nativeDecimals) * 10^6 (computeUnitPriceDecimals) / 200000 (computeUnitLimit)
    // = 10^6 * 10^6 / 200000 = 10^12 / 2*10^5 = 5*10^6 = 5000000
    expect(result.feeSol?.computeUnitPrice).toBe('5000000');
  });

  test('rounds up Solana computeUnitPrice (ceiling) when division is not exact', () => {
    const gasInfo: ISwapGasInfo = {
      common: baseSolCommon,
      feeSol: { computeUnitPrice: '0' },
    };
    const estimateFeeParams: IEstimateFeeParams = {
      estimateFeeParamsSol: {
        computeUnitLimit: '300000',
        computeUnitPriceDecimals: 6,
        baseFee: '5000',
      },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '0.001' },
      estimateFeeParams,
    });

    // 0.001 * 10^9 * 10^6 / 300000 = 10^12 / 3*10^5 = 3,333,333.333... → ceil → 3,333,334
    expect(result.feeSol?.computeUnitPrice).toBe('3333334');
  });

  test('returns gasInfo unchanged for Solana when computeUnitLimit is missing', () => {
    const gasInfo: ISwapGasInfo = {
      common: baseSolCommon,
      feeSol: { computeUnitPrice: '0' },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '0.001' },
      // no estimateFeeParams
    });

    expect(result).toBe(gasInfo);
  });

  test('returns gasInfo unchanged when chain has no editable fee field (feeUTXO / feeTron / etc)', () => {
    const gasInfo: ISwapGasInfo = {
      common: { ...baseCommon, feeSymbol: 'sat', nativeSymbol: 'BTC' },
      feeUTXO: { feeRate: '10' },
    };

    const result = applyCustomPriorityFeeToGasInfo({
      gasInfo,
      customPriorityFee: { customValue: '5' },
    });

    expect(result).toBe(gasInfo);
  });
});
