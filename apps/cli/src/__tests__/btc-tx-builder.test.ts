import { EOutputsTypeForCoinSelect } from '@onekeyhq/core/src/chains/btc/types';
import { coinSelectWithWitness } from '@onekeyhq/core/src/utils/coinSelectUtils';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { getBtcAddressTypeInfo } from '../core/btc/address-types';
import { buildBtcTransferTx } from '../core/btc/tx-builder';
import { ERROR_CODES } from '../errors';
import { apiClient } from '../infra';

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

jest.mock('@onekeyhq/core/src/utils/coinSelectUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/core/src/utils/coinSelectUtils')
  >('@onekeyhq/core/src/utils/coinSelectUtils');
  return {
    ...actual,
    coinSelectWithWitness: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockCoinSelectWithWitness = coinSelectWithWitness as jest.MockedFunction<
  typeof coinSelectWithWitness
>;

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
          value: 100_000,
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

    const result = await buildBtcTransferTx(buildParams());

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
            value: 100_000,
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

  it('keeps provider memo as an OP_RETURN output when building a BTC provider deposit tx', async () => {
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
          value: 100_000,
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
          type: EOutputsTypeForCoinSelect.OpReturn,
          address: '',
          dataHex: '74686f722d6d656d6f',
        },
        {
          address: fromAddress,
          amount: '98510',
        },
      ],
      fee: 490,
      bytes: 184,
    } as never);

    const result = await buildBtcTransferTx(
      buildParams({ opReturn: 'thor-memo' }),
    );

    expect(mockCoinSelectWithWitness).toHaveBeenCalledWith(
      expect.objectContaining({
        outputsForCoinSelect: [
          {
            type: EOutputsTypeForCoinSelect.Payment,
            address: toAddress,
            value: 1000,
            amount: '1000',
          },
          {
            type: EOutputsTypeForCoinSelect.OpReturn,
            address: '',
            dataHex: '74686f722d6d656d6f',
          },
        ],
      }),
    );
    expect(result.encodedTx.outputs).toEqual([
      { address: toAddress, value: '1000' },
      {
        address: '',
        value: '0',
        payload: { opReturn: 'thor-memo' },
      },
      {
        address: fromAddress,
        value: '98510',
        payload: {
          isChange: true,
          bip44Path: fromPath,
        },
      },
    ]);
    expect(result.summary.outputCount).toBe(3);
  });

  it('throws insufficient balance when the selected address has no UTXOs', async () => {
    mockGet.mockResolvedValue({ utxoList: [] });

    await expect(buildBtcTransferTx(buildParams())).rejects.toMatchObject({
      code: ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
      message: 'No usable BTC UTXOs found.',
    });
    expect(mockCoinSelectWithWitness).not.toHaveBeenCalled();
  });

  it('rejects amounts with more than 8 decimal places before converting satoshis', async () => {
    await expect(
      buildBtcTransferTx(buildParams({ amount: '0.000000001' })),
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

    await expect(buildBtcTransferTx(buildParams())).rejects.toMatchObject({
      code: ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
      message: 'BTC coin selection failed.',
      details: expect.objectContaining({
        inputCount: 1,
        paymentAmount: '1000',
      }),
    });
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

    await expect(buildBtcTransferTx(buildParams())).rejects.toMatchObject({
      code: ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
      message: 'BTC coin selection failed.',
      details: expect.objectContaining({
        inputCount: 1,
        paymentAmount: '1000',
      }),
    });
  });
});
