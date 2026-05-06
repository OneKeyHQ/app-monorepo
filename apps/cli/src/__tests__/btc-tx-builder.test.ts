import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import { EOutputsTypeForCoinSelect } from '@onekeyhq/core/src/chains/btc/types';
import { coinSelectWithWitness } from '@onekeyhq/core/src/utils/coinSelectUtils';

import { ERROR_CODES } from '../errors';
import { apiClient } from '../infra';
import { getBtcAddressTypeInfo } from '../core/btc/address-types';
import { buildBtcTransferTxForTest } from '../core/btc/tx-builder';

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

jest.mock('@onekeyhq/core/src/utils/coinSelectUtils', () => {
  const actual = jest.requireActual('@onekeyhq/core/src/utils/coinSelectUtils');
  return {
    ...actual,
    coinSelectWithWitness: jest.fn(),
  };
});

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockCoinSelectWithWitness =
  coinSelectWithWitness as jest.MockedFunction<typeof coinSelectWithWitness>;

const addressTypeInfo = getBtcAddressTypeInfo('tbtc', 'taproot');
const fromAddress =
  'tb1pzutpcaymsyxtmz325ucsjed4evp9mea05tsf32wnkx46vsjrqtrq4d3dmr';
const toAddress =
  'tb1pdestination0000000000000000000000000000000000000000000000';
const fromPath = addressTypeInfo.path;

function buildParams(overrides = {}) {
  return {
    impl: 'tbtc',
    networkId: 'tbtc--0',
    fromAddress,
    fromPath,
    toAddress,
    amount: '0.00001',
    nativeDecimals: 8,
    feeRate: '1',
    addressTypeInfo,
    ...overrides,
  };
}

describe('BTC transfer tx builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a single native TBTC payment with selected taproot UTXO and change to the first receive address', async () => {
    mockGet.mockResolvedValue({
      utxoList: [
        {
          txid: 'tx-1',
          vout: 0,
          value: '100000',
          address: fromAddress,
          path: fromPath,
          confirmations: 6,
          rawTx: '02000000raw',
        },
      ],
    });
    mockCoinSelectWithWitness.mockReturnValue({
      inputs: [
        {
          txId: 'tx-1',
          txid: 'tx-1',
          vout: 0,
          value: 100000,
          amount: '100000',
          address: fromAddress,
          path: fromPath,
          confirmations: 6,
        },
      ],
      outputs: [
        {
          address: toAddress,
          amount: '1000',
        },
        {
          address: fromAddress,
          amount: '98750',
        },
      ],
      fee: 250,
      bytes: 154,
    } as never);

    const result = await buildBtcTransferTxForTest(buildParams());

    expect(mockGet).toHaveBeenCalledWith(
      'wallet',
      '/wallet/v1/account/get-account',
      {
        networkId: 'tbtc--0',
        accountAddress: fromAddress,
        withUTXOList: true,
        withNetWorth: true,
      },
    );
    expect(mockCoinSelectWithWitness).toHaveBeenCalledWith(
      expect.objectContaining({
        inputsForCoinSelect: [
          {
            txId: 'tx-1',
            vout: 0,
            value: 100000,
            amount: '100000',
            address: fromAddress,
            path: fromPath,
            confirmations: 6,
          },
        ],
        outputsForCoinSelect: [
          {
            type: EOutputsTypeForCoinSelect.Payment,
            address: toAddress,
            value: 1000,
            amount: '1000',
          },
        ],
        feeRate: '1',
        changeAddress: { address: fromAddress, path: fromPath },
        txType: 'p2tr',
      }),
    );

    expect(result.encodedTx.inputs).toEqual([
      {
        txid: 'tx-1',
        vout: 0,
        value: '100000',
        address: fromAddress,
        path: fromPath,
      },
    ]);
    expect(result.encodedTx.outputs).toEqual([
      { address: toAddress, value: '1000' },
      {
        address: fromAddress,
        value: '98750',
        payload: {
          isChange: true,
          bip44Path: fromPath,
        },
      },
    ]);
    expect(result.btcExtraInfo.pathToAddresses[fromPath]).toEqual({
      address: fromAddress,
      relPath: '0/0',
      fullPath: fromPath,
    });
    expect(result.btcExtraInfo.addressToPath[fromAddress]).toEqual({
      address: fromAddress,
      relPath: '0/0',
      fullPath: fromPath,
    });
    expect(result.btcExtraInfo.inputAddressesEncodings).toHaveLength(
      result.encodedTx.inputs.length,
    );
    expect(result.btcExtraInfo.inputAddressesEncodings).toEqual([
      EAddressEncodings.P2TR,
    ]);
    expect(result.btcExtraInfo.nonWitnessPrevTxs).toEqual({
      'tx-1': '02000000raw',
    });
    expect(result.relPaths).toEqual(['0/0']);
    expect(result.summary).toEqual({
      fee: '250',
      txSize: 154,
      inputCount: 1,
      outputCount: 2,
    });
  });

  it('throws insufficient balance when the selected address has no UTXOs', async () => {
    mockGet.mockResolvedValue({ utxoList: [] });

    await expect(buildBtcTransferTxForTest(buildParams())).rejects.toMatchObject(
      {
        code: ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
        message: 'No usable BTC UTXOs found.',
      },
    );
    expect(mockCoinSelectWithWitness).not.toHaveBeenCalled();
  });

  it('rejects amounts with more than 8 decimal places before converting satoshis', async () => {
    await expect(
      buildBtcTransferTxForTest(buildParams({ amount: '0.000000001' })),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PARAM_INVALID_AMOUNT.code,
    });
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockCoinSelectWithWitness).not.toHaveBeenCalled();
  });

  it('throws a structured insufficient balance error when coin selection fails', async () => {
    mockGet.mockResolvedValue({
      utxoList: [
        {
          txid: 'tx-1',
          vout: 0,
          value: '1000',
          address: fromAddress,
          path: fromPath,
        },
      ],
    });
    mockCoinSelectWithWitness.mockReturnValue({
      inputs: undefined,
      outputs: undefined,
      fee: undefined,
      bytes: undefined,
    });

    await expect(buildBtcTransferTxForTest(buildParams())).rejects.toMatchObject(
      {
        code: ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
        message: 'BTC coin selection failed.',
        details: expect.objectContaining({
          inputCount: 1,
          paymentAmount: '1000',
        }),
      },
    );
  });

  it('throws a structured insufficient balance error when coin selection returns an input without vout', async () => {
    mockGet.mockResolvedValue({
      utxoList: [
        {
          txid: 'tx-1',
          vout: 0,
          value: '1000',
          address: fromAddress,
          path: fromPath,
        },
      ],
    });
    mockCoinSelectWithWitness.mockReturnValue({
      inputs: [
        {
          txId: 'tx-1',
          value: 1000,
          amount: '1000',
          address: fromAddress,
          path: fromPath,
        },
      ],
      outputs: [
        {
          address: toAddress,
          value: 1000,
        },
      ],
      fee: 0,
      bytes: 100,
    } as never);

    await expect(buildBtcTransferTxForTest(buildParams())).rejects.toMatchObject(
      {
        code: ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
        message: 'BTC coin selection failed.',
        details: expect.objectContaining({
          inputCount: 1,
          paymentAmount: '1000',
        }),
      },
    );
  });
});
