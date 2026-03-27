import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

const mockPrepareSendConfirmUnsignedTx = jest.fn();
const mockGetVaultSettings = jest.fn();
const mockBuildEstimateFeeParams = jest.fn();
const mockBatchEstimateFee = jest.fn();
const mockEstimateFee = jest.fn();
const mockUpdateUnsignedTx = jest.fn();
const mockPrecheckUnsignedTxs = jest.fn();
const mockVerifyTransaction = jest.fn();
const mockSignAndSendTransaction = jest.fn();
const mockBuildDecodedTx = jest.fn();
const mockSaveSendConfirmHistoryTxs = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSend: {
      prepareSendConfirmUnsignedTx: mockPrepareSendConfirmUnsignedTx,
      updateUnsignedTx: mockUpdateUnsignedTx,
      precheckUnsignedTxs: mockPrecheckUnsignedTxs,
      signAndSendTransaction: mockSignAndSendTransaction,
      buildDecodedTx: mockBuildDecodedTx,
    },
    serviceNetwork: {
      getVaultSettings: mockGetVaultSettings,
    },
    serviceGas: {
      buildEstimateFeeParams: mockBuildEstimateFeeParams,
      batchEstimateFee: mockBatchEstimateFee,
      estimateFee: mockEstimateFee,
    },
    serviceTransaction: {
      verifyTransaction: mockVerifyTransaction,
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: mockSaveSendConfirmHistoryTxs,
    },
  },
}));

const {
  estimateMarketApproveGasInfos,
  estimateMarketDirectGasInfos,
  sendMarketDirectUnsignedTxs,
} = require('./marketDirectSendTx') as typeof import('./marketDirectSendTx');

function createUnsignedTx(
  overrides: Partial<IUnsignedTxPro> = {},
): IUnsignedTxPro {
  return {
    encodedTx: {
      data: '0xencoded',
    } as never,
    nonce: 1,
    ...overrides,
  } as IUnsignedTxPro;
}

function createEstimateFeeResult() {
  return {
    common: {
      feeDecimals: 18,
      feeSymbol: 'ETH',
      nativeDecimals: 18,
      nativeSymbol: 'ETH',
      nativeTokenPrice: 3000,
    },
    gas: [
      {
        gasPrice: '1',
        gasLimit: '21000',
      },
      {
        gasPrice: '2',
        gasLimit: '22000',
      },
      {
        gasPrice: '3',
        gasLimit: '23000',
      },
    ],
  };
}

describe('marketDirectSendTx', () => {
  beforeEach(() => {
    mockPrepareSendConfirmUnsignedTx.mockReset();
    mockGetVaultSettings.mockReset();
    mockBuildEstimateFeeParams.mockReset();
    mockBatchEstimateFee.mockReset();
    mockEstimateFee.mockReset();
    mockUpdateUnsignedTx.mockReset();
    mockPrecheckUnsignedTxs.mockReset();
    mockVerifyTransaction.mockReset();
    mockSignAndSendTransaction.mockReset();
    mockBuildDecodedTx.mockReset();
    mockSaveSendConfirmHistoryTxs.mockReset();

    mockGetVaultSettings.mockResolvedValue({});
    mockBuildEstimateFeeParams.mockImplementation(async ({ encodedTx }) => ({
      encodedTx,
    }));
    mockEstimateFee.mockResolvedValue(createEstimateFeeResult());
    mockUpdateUnsignedTx.mockImplementation(async ({ unsignedTx }) => {
      return unsignedTx as never;
    });
    mockPrecheckUnsignedTxs.mockResolvedValue(undefined);
    mockVerifyTransaction.mockResolvedValue(undefined);
    mockSignAndSendTransaction.mockResolvedValue({
      txid: '0xtx',
      rawTx: '0xraw',
    });
    mockBuildDecodedTx.mockResolvedValue({
      txid: '0xtx',
      networkId: 'evm--1',
      totalFeeFiatValue: '0.12',
      totalFeeInNative: '0.0001',
    });
    mockSaveSendConfirmHistoryTxs.mockResolvedValue(undefined);
  });

  it('sends a single unsigned tx through the direct sign-and-send path', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());

    const result = await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result).toHaveLength(1);
    expect(mockPrepareSendConfirmUnsignedTx).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(mockSaveSendConfirmHistoryTxs).toHaveBeenCalledTimes(1);
    expect(mockBatchEstimateFee).not.toHaveBeenCalled();
  });

  it('sends batch approve plus swap with batch fee estimation when supported', async () => {
    const approveUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xapprove',
      } as never,
      nonce: 1,
    });
    const swapUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xswap',
      } as never,
      nonce: 2,
    });

    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(swapUnsignedTx);
    mockGetVaultSettings.mockResolvedValue({
      supportBatchEstimateFee: {
        'evm--1': true,
      },
    });
    mockBatchEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      txFees: [createEstimateFeeResult(), createEstimateFeeResult()],
    });

    const result = await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xswap',
        } as never,
        isInternalSwap: true,
      },
      approveUnsignedTxArr: [approveUnsignedTx],
    });

    expect(result).toHaveLength(2);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockUpdateUnsignedTx).toHaveBeenCalledTimes(2);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(2);
    expect(mockSaveSendConfirmHistoryTxs).toHaveBeenCalledTimes(2);
  });

  it('builds gas infos from the selected fee level', async () => {
    const preparedUnsignedTx = createUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(preparedUnsignedTx);

    const lowFeeResult = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.LOW,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });
    const highFeeResult = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(lowFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('1');
    expect(highFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('3');
    expect(lowFeeResult.gasFeeFiatValue).not.toBe(
      highFeeResult.gasFeeFiatValue,
    );
    expect(lowFeeResult.preparedUnsignedTx).toBe(preparedUnsignedTx);
    expect(highFeeResult.preparedUnsignedTx).toBe(preparedUnsignedTx);
  });

  it('estimates approve-only gas infos from the selected fee level', async () => {
    const resetApproveUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xreset',
      } as never,
      nonce: 1,
    });
    const approveUnsignedTx = createUnsignedTx({
      encodedTx: {
        data: '0xapprove',
      } as never,
      nonce: 2,
    });

    const lowFeeResult = await estimateMarketApproveGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.LOW,
      approveUnsignedTxArr: [resetApproveUnsignedTx, approveUnsignedTx],
    });
    const highFeeResult = await estimateMarketApproveGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      approveUnsignedTxArr: [resetApproveUnsignedTx, approveUnsignedTx],
    });

    expect(lowFeeResult.gasInfos).toHaveLength(2);
    expect(highFeeResult.gasInfos).toHaveLength(2);
    expect(lowFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('1');
    expect(highFeeResult.gasInfos[0].gasInfo.gas?.gasPrice).toBe('3');
    expect(mockEstimateFee).toHaveBeenCalledTimes(4);
  });

  it('preserves the selected fee level when send-time gas info must be rebuilt', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());

    await sendMarketDirectUnsignedTxs({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
      gasInfos: [
        {
          encodeTx: {
            data: '0xother',
          } as never,
          gasInfo: {
            common: createEstimateFeeResult().common,
            gas: {
              gasPrice: '1',
              gasLimit: '21000',
            },
          } as never,
        },
      ],
    });

    expect(mockUpdateUnsignedTx).toHaveBeenCalledWith(
      expect.objectContaining({
        feeInfo: expect.objectContaining({
          gas: expect.objectContaining({
            gasPrice: '3',
          }),
        }),
      }),
    );
  });
});
