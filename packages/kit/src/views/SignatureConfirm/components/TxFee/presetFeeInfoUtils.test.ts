import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';

import { buildPresetMultiTxsFee } from './presetFeeInfoUtils';

const common = {
  feeDecimals: 9,
  feeSymbol: 'Gwei',
  nativeDecimals: 18,
  nativeSymbol: 'ETH',
  nativeTokenPrice: 1000,
};

function createUnsignedTx(feeInfo?: IUnsignedTxPro['feeInfo']) {
  return {
    encodedTx: {},
    feeInfo,
  } as IUnsignedTxPro;
}

describe('buildPresetMultiTxsFee', () => {
  it('wraps pre-attached feeInfo into a single locked multi-tx fee preset', () => {
    expect(
      buildPresetMultiTxsFee([
        createUnsignedTx({
          common,
          gasEIP1559: {
            baseFeePerGas: '1',
            maxFeePerGas: '2',
            maxPriorityFeePerGas: '1.5',
            gasLimit: '21000',
            gasLimitForDisplay: '21000',
          },
        }),
        createUnsignedTx({
          common,
          gasEIP1559: {
            baseFeePerGas: '1',
            maxFeePerGas: '2',
            maxPriorityFeePerGas: '1.5',
            gasLimit: '180000',
            gasLimitForDisplay: '180000',
          },
        }),
      ]),
    ).toEqual({
      common,
      txFees: [
        {
          gas: undefined,
          gasEIP1559: [
            {
              baseFeePerGas: '1',
              maxFeePerGas: '2',
              maxPriorityFeePerGas: '1.5',
              gasLimit: '21000',
              gasLimitForDisplay: '21000',
            },
          ],
        },
        {
          gas: undefined,
          gasEIP1559: [
            {
              baseFeePerGas: '1',
              maxFeePerGas: '2',
              maxPriorityFeePerGas: '1.5',
              gasLimit: '180000',
              gasLimitForDisplay: '180000',
            },
          ],
        },
      ],
    });
  });

  it('does not build a preset when any tx is missing feeInfo', () => {
    expect(
      buildPresetMultiTxsFee([
        createUnsignedTx({
          common,
          gas: {
            gasPrice: '2',
            gasLimit: '21000',
          },
        }),
        createUnsignedTx(),
      ]),
    ).toBeUndefined();
  });
});
