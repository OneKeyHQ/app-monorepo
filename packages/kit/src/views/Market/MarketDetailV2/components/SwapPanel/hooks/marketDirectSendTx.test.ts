import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

const mockPrepareSendConfirmUnsignedTx = jest.fn();
const mockBuildUnsignedTx = jest.fn();
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
const mockPreActionsBeforeSending = jest.fn();
const mockAfterSendTxAction = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSend: {
      buildUnsignedTx: mockBuildUnsignedTx,
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
    serviceSignatureConfirm: {
      preActionsBeforeSending: mockPreActionsBeforeSending,
      afterSendTxAction: mockAfterSendTxAction,
    },
  },
}));

const {
  buildMarketPresetFeeEstimateFakeTransferInfo,
  estimateMarketPresetGasFeeFiatValues,
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

function createMarketPresetToken(overrides = {}) {
  return {
    contractAddress: '',
    decimals: 18,
    isNative: true,
    networkId: 'evm--1',
    symbol: 'ETH',
    ...overrides,
  };
}

describe('marketDirectSendTx', () => {
  beforeEach(() => {
    mockPrepareSendConfirmUnsignedTx.mockReset();
    mockBuildUnsignedTx.mockReset();
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
    mockPreActionsBeforeSending.mockReset();
    mockAfterSendTxAction.mockReset();

    mockGetVaultSettings.mockResolvedValue({});
    mockBuildUnsignedTx.mockResolvedValue(createUnsignedTx());
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
    mockPreActionsBeforeSending.mockResolvedValue(undefined);
    mockAfterSendTxAction.mockResolvedValue(undefined);
  });

  it('builds market preset fake transfer info as an isolated self-transfer', () => {
    const transferInfo = buildMarketPresetFeeEstimateFakeTransferInfo({
      accountAddress: '0xuser',
      amount: '',
      token: createMarketPresetToken(),
    });

    expect(transferInfo).toEqual({
      amount: '0',
      from: '0xuser',
      to: '0xuser',
      tokenInfo: {
        address: '',
        decimals: 18,
        isNative: true,
        logoURI: undefined,
        name: 'ETH',
        networkId: 'evm--1',
        symbol: 'ETH',
      },
    });

    expect(
      buildMarketPresetFeeEstimateFakeTransferInfo({
        accountAddress: '0xuser',
        token: createMarketPresetToken({
          contractAddress: '',
          isNative: false,
          symbol: 'USDT',
        }),
      }),
    ).toBeUndefined();
  });

  it('estimates market preset fees from the isolated fake unsigned tx', async () => {
    const fakeEncodedTx = { data: '0xfake-preset' };
    const transferInfo = buildMarketPresetFeeEstimateFakeTransferInfo({
      accountAddress: '0xuser',
      token: createMarketPresetToken(),
    });
    mockBuildUnsignedTx.mockResolvedValue(
      createUnsignedTx({
        encodedTx: fakeEncodedTx as IUnsignedTxPro['encodedTx'],
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        txSize: 123,
      }),
    );

    const result = await estimateMarketPresetGasFeeFiatValues({
      accountAddress: '0xuser',
      accountId: 'account-1',
      amount: '',
      items: [{ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM }],
      networkId: 'evm--1',
      token: createMarketPresetToken(),
    });

    expect(mockBuildUnsignedTx).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
      transfersInfo: [
        expect.objectContaining({
          amount: '0',
          from: '0xuser',
          to: '0xuser',
        }),
      ],
    });
    expect(mockBuildEstimateFeeParams).toHaveBeenCalledWith({
      accountId: 'account-1',
      encodedTx: fakeEncodedTx,
      networkId: 'evm--1',
    });
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        accountAddress: '0xuser',
        accountId: 'account-1',
        encodedTx: fakeEncodedTx,
        networkId: 'evm--1',
        scenario: 'swap',
        transfersInfo: transferInfo ? [transferInfo] : undefined,
      }),
    );
    expect(result[0]).toBeDefined();
  });

  it('falls back to fee-rate preset estimation when fake tx cannot be built', async () => {
    mockBuildUnsignedTx.mockRejectedValueOnce(new Error('fake tx failed'));

    const result = await estimateMarketPresetGasFeeFiatValues({
      accountAddress: '0xuser',
      accountId: 'account-1',
      items: [{ networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM }],
      networkId: 'evm--1',
      token: createMarketPresetToken(),
    });

    expect(mockBuildEstimateFeeParams).toHaveBeenCalledWith({
      accountId: 'account-1',
      encodedTx: undefined,
      networkId: 'evm--1',
    });
    expect(result[0]).toBeDefined();
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

  it('falls back to sequential estimation when batch tx fee results are shorter than expected for direct send', async () => {
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
      txFees: [createEstimateFeeResult()],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
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

    expect(result.gasInfos).toHaveLength(2);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(result.gasFeeFiatValue).toBeDefined();
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

  it('converts a custom EVM legacy priority fee from Gwei to fee unit', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      customPriorityFee: {
        customValue: '7',
      },
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.gas?.gasPrice).toBe('0.000000007');
  });

  it('converts a custom EVM EIP-1559 priority fee from Gwei to fee unit', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      gasEIP1559: [
        {
          baseFeePerGas: '0.00000001',
          maxPriorityFeePerGas: '0.000000001',
          maxFeePerGas: '0.000000011',
          gasLimit: '21000',
        },
      ],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      customPriorityFee: {
        customValue: '5',
      },
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.gasEIP1559).toEqual(
      expect.objectContaining({
        maxPriorityFeePerGas: '0.000000005',
        maxFeePerGas: '0.000000025',
      }),
    );
  });

  it('keeps a custom EVM priority fee in Gwei when the fee unit is already Gwei', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      common: {
        ...createEstimateFeeResult().common,
        feeDecimals: 9,
        feeSymbol: 'Gwei',
      },
      gas: [
        {
          gasPrice: '1',
          gasLimit: '21000',
        },
      ],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      customPriorityFee: {
        customValue: '7',
      },
      buildUnsignedParams: {
        accountId: 'account-1',
        networkId: 'evm--1',
        encodedTx: {
          data: '0xencoded',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.gas?.gasPrice).toBe('7');
  });

  it('converts a custom Solana total priority fee into compute unit price', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockBuildEstimateFeeParams.mockImplementation(async ({ encodedTx }) => ({
      encodedTx,
      estimateFeeParams: {
        estimateFeeParamsSol: {
          baseFee: '5000',
          computeUnitLimit: '200000',
          computeUnitPriceDecimals: 6,
        },
      },
    }));
    mockEstimateFee.mockResolvedValue({
      common: {
        feeDecimals: 9,
        feeSymbol: 'SOL',
        nativeDecimals: 9,
        nativeSymbol: 'SOL',
        nativeTokenPrice: 100,
      },
      feeSol: [
        {
          computeUnitPrice: '1000',
        },
      ],
    });

    const result = await estimateMarketDirectGasInfos({
      accountAddress: 'sol-user',
      accountId: 'account-sol',
      networkId: 'sol--101',
      customPriorityFee: {
        customValue: '0.001',
      },
      buildUnsignedParams: {
        accountId: 'account-sol',
        networkId: 'sol--101',
        encodedTx: {
          data: 'sol-tx',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(result.gasInfos[0].gasInfo.feeSol?.computeUnitPrice).toBe('5000000');
    expect(result.gasInfos[0].estimateFeeParams?.estimateFeeParamsSol).toEqual({
      baseFee: '5000',
      computeUnitLimit: '200000',
      computeUnitPriceDecimals: 6,
    });
    // Regression guard: without estimateFeeParams plumbed through, the SOL
    // branch returns only baseFee (~$0.0005) instead of ~$0.1005.
    expect(result.gasFeeFiatValue).toBeDefined();
    expect(Number(result.gasFeeFiatValue)).toBeCloseTo(0.1005, 4);
  });

  it('ignores gas infos without common data when aggregating fiat values', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      gas: [
        {
          gasPrice: '1',
          gasLimit: '21000',
        },
      ],
    } as never);

    const result = await estimateMarketDirectGasInfos({
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

    expect(result.gasInfos).toHaveLength(1);
    expect(result.gasInfos[0].gasInfo.common).toBeUndefined();
    expect(result.gasFeeFiatValue).toBeUndefined();
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

  it('falls back to sequential estimation when batch tx fee results are shorter than expected for approve-only gas infos', async () => {
    const approveUnsignedTxA = createUnsignedTx({
      encodedTx: {
        data: '0xapprove-a',
      } as never,
      nonce: 1,
    });
    const approveUnsignedTxB = createUnsignedTx({
      encodedTx: {
        data: '0xapprove-b',
      } as never,
      nonce: 2,
    });

    mockGetVaultSettings.mockResolvedValue({
      supportBatchEstimateFee: {
        'evm--1': true,
      },
    });
    mockBatchEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      txFees: [createEstimateFeeResult()],
    });

    const result = await estimateMarketApproveGasInfos({
      accountAddress: '0xuser',
      accountId: 'account-1',
      networkId: 'evm--1',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      approveUnsignedTxArr: [approveUnsignedTxA, approveUnsignedTxB],
    });

    expect(result.gasInfos).toHaveLength(2);
    expect(mockBatchEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledTimes(2);
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

  it('keeps Tron high fee selection aligned with the legacy confirm flow', async () => {
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(createUnsignedTx());
    mockEstimateFee.mockResolvedValue({
      common: createEstimateFeeResult().common,
      feeTron: [
        {
          requiredEnergy: '10',
          requiredBandwidth: '100',
        },
        {
          requiredEnergy: '20',
          requiredBandwidth: '200',
        },
        {
          requiredEnergy: '30',
          requiredBandwidth: '300',
        },
      ],
    });

    const highFeeResult = await estimateMarketDirectGasInfos({
      accountAddress: 'TUser',
      accountId: 'account-tron',
      networkId: 'tron--0x2b6653dc',
      networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      buildUnsignedParams: {
        accountId: 'account-tron',
        networkId: 'tron--0x2b6653dc',
        encodedTx: {
          raw_data_hex: '0xtron',
        } as never,
        isInternalSwap: true,
      },
    });

    expect(highFeeResult.gasInfos[0].gasInfo.feeTron?.requiredEnergy).toBe(
      '10',
    );
    expect(highFeeResult.gasInfos[0].gasInfo.feeTron?.requiredBandwidth).toBe(
      '100',
    );
  });

  it('runs legacy send hooks around direct send execution', async () => {
    const preparedUnsignedTx = createUnsignedTx();
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue(preparedUnsignedTx);
    mockGetVaultSettings.mockResolvedValue({
      afterSendTxActionEnabled: true,
    });

    await sendMarketDirectUnsignedTxs({
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

    expect(mockPreActionsBeforeSending).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
      unsignedTxs: [preparedUnsignedTx],
      tronResourceRentalInfo: undefined,
    });
    expect(mockAfterSendTxAction).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountId: 'account-1',
      result: [
        expect.objectContaining({
          signedTx: expect.objectContaining({
            txid: '0xtx',
          }),
        }),
      ],
    });
  });
});
