import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IEstimateGasParams,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';

import { VaultBase } from '../../base/VaultBase';

import { EvmApiProvider } from './sdkEvm/EvmApiProvider';
import EvmVault from './Vault';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// Instantiating the full vault requires a backgroundApi context; the
// buildUnsignedTx nonce-chaining path only touches networkId, so a bare
// prototype instance is enough.
const buildVault = () => {
  const vault = Object.create(EvmVault.prototype) as EvmVault;
  vault.networkId = 'evm--8453';
  return vault;
};

const baseEncodedTx: IEncodedTxEvm = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '0x0',
  data: '0x',
};

describe('EvmVault provider gas limit', () => {
  const params: IEstimateGasParams = {
    networkId: 'evm--1',
    accountId: 'test',
    accountAddress: baseEncodedTx.from!,
    encodedTx: {
      ...baseEncodedTx,
      value: '0x1234',
      data: '0x123456',
      nonce: 7,
    },
    gasLimit: '240972',
    gasAccountEnabled: true,
    lockedUserNonce: 7,
  };
  let request: jest.SpyInstance;
  beforeEach(() => {
    request = jest
      .spyOn(VaultBase.prototype, 'estimateFeeByApi')
      .mockImplementation(
        async () =>
          ({
            data: {
              data: {
                isEIP1559: true,
                feeDecimals: 9,
                feeSymbol: 'Gwei',
                nativeDecimals: 18,
                nativeSymbol: 'ETH',
                baseFee: '0',
                gas: [{ gasPrice: '2', gasLimit: '30748' }],
                gasEIP1559: [
                  {
                    baseFeePerGas: '1',
                    maxFeePerGas: '3',
                    maxPriorityFeePerGas: '2',
                    gasLimit: '30748',
                    gasLimitForDisplay: '30748',
                  },
                ],
              },
            },
          }) satisfies IServerEstimateFeeResponse,
      );
  });
  afterEach(() => jest.restoreAllMocks());

  const vaultWithNetwork = (isWithL1BaseFee = false) => {
    const vault = buildVault();
    jest.spyOn(vault, 'getNetwork').mockResolvedValue({
      feeMeta: { isWithL1BaseFee },
    } as IServerNetwork);
    return vault;
  };

  const vaultWithL1Proxy = (
    proxyRPCCall: () => Promise<Promise<string | undefined>[]>,
    networkId = params.networkId,
  ) => {
    const vault = vaultWithNetwork(true);
    vault.networkId = networkId;
    vault.backgroundApi = {
      serviceNetwork: {
        getNetwork: jest.fn().mockResolvedValue({
          feeMeta: { isWithL1BaseFee: true },
        }),
      },
      serviceDApp: { proxyRPCCall },
    } as unknown as EvmVault['backgroundApi'];
    return vault;
  };

  it('requests only prices and uses the provider limit without another buffer for every fee tier', async () => {
    const vault = vaultWithNetwork();
    const result = await vault.estimateFeeByApi(params);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: undefined,
        gasAccountEnabled: false,
        lockedUserNonce: undefined,
      }),
    );
    expect(request.mock.calls[0][0]).not.toHaveProperty('gasLimit');
    expect(result.data.data.gas?.[0]).toMatchObject({
      gasLimit: '240972',
      gasLimitForDisplay: '240972',
      gasPrice: '2',
    });
    expect(result.data.data.gasEIP1559?.[0]).toMatchObject({
      gasLimit: '240972',
      gasLimitForDisplay: '240972',
      maxFeePerGas: '3',
    });
    expect(result.data.data.payer).toBe('user');
    expect(result.data.data.gasAccountQuote).toBeUndefined();
    const encoded = await vault._attachFeeInfoToEncodedTx({
      encodedTx: params.encodedTx as IEncodedTxEvm,
      feeInfo: {
        common: {
          feeDecimals: 9,
          feeSymbol: 'Gwei',
          nativeDecimals: 18,
          nativeSymbol: 'ETH',
        },
        gasEIP1559: result.data.data.gasEIP1559?.[0],
      },
    });
    expect(BigInt(encoded.gasLimit!)).toBe(240_972n);
    expect(encoded.value).toBe('0x1234');
  });

  it.each([undefined, '0', '-1', '1.5', 'NaN', 'Infinity'])(
    'keeps normal estimation for invalid or missing limit %s',
    async (gasLimit) => {
      await vaultWithNetwork().estimateFeeByApi({
        ...params,
        gasLimit,
      });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          encodedTx: params.encodedTx,
          gasAccountEnabled: true,
        }),
      );
    },
  );

  it.each([
    {
      networkId: 'evm--8453',
      chainId: '0x2105',
      oracleAddress: '0x420000000000000000000000000000000000000f',
    },
    {
      networkId: 'evm--534352',
      chainId: '0x82750',
      oracleAddress: '0x5300000000000000000000000000000000000002',
    },
  ])(
    'prices L1 data through the wallet proxy and correct oracle on $networkId',
    async ({ networkId, chainId, oracleAddress }) => {
      const proxyRPCCall = jest.fn(async () => [Promise.resolve('0x89173700')]);
      const vault = vaultWithL1Proxy(proxyRPCCall, networkId);
      expect(await vault.getRpcUrl()).toBe('');
      const extraFee = jest.spyOn(EvmApiProvider.prototype, 'getGasFee');
      const estimateGas = jest.spyOn(EvmApiProvider.prototype, 'getGasLimit');
      const rpcCall = jest
        .spyOn(JsonRPCRequest.prototype, 'call')
        .mockResolvedValue('0x89173700');
      const encodedTx = {
        ...(params.encodedTx as IEncodedTxEvm),
        chainId,
      };
      const result = await vault.estimateFeeByApi({
        ...params,
        networkId,
        encodedTx,
      });

      expect(extraFee).toHaveBeenCalledWith({
        networkId,
        encodedTx: { ...encodedTx, gasLimit: '0x3ad4c' },
      });
      expect(proxyRPCCall).toHaveBeenCalledTimes(1);
      expect(proxyRPCCall).toHaveBeenCalledWith({
        networkId,
        request: {
          jsonrpc: '2.0',
          id: 0,
          method: 'eth_call',
          params: [
            { to: oracleAddress, data: expect.stringMatching(/^0x/) },
            'latest',
          ],
        },
        origin: 'onekey://swap',
      });
      expect(rpcCall).not.toHaveBeenCalled();
      expect(estimateGas).not.toHaveBeenCalled();
      expect(result.data.data.baseFee).toBe('3.45');
      expect(result.data.data.gasEIP1559?.[0]).toMatchObject({
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      });
      expect(encodedTx).not.toHaveProperty('gasLimit');
    },
  );

  it.each([undefined, 'not-a-fee', '-1', 'Infinity'])(
    'rejects invalid L1 proxy fee %s instead of returning a zero fee',
    async (fee) => {
      const proxyRPCCall = jest.fn(async () => [Promise.resolve(fee)]);
      const vault = vaultWithL1Proxy(proxyRPCCall);

      await expect(vault.estimateFeeByApi(params)).rejects.toThrow(
        'Invalid L1 data fee',
      );
      expect(proxyRPCCall).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates a rejected L1 proxy result instead of returning a zero fee', async () => {
    const error = new Error('L1 oracle unavailable');
    const proxyRPCCall = jest.fn(async () => [Promise.reject(error)]);
    const vault = vaultWithL1Proxy(proxyRPCCall);

    await expect(vault.estimateFeeByApi(params)).rejects.toBe(error);
    expect(proxyRPCCall).toHaveBeenCalledTimes(1);
  });
});

describe('EvmApiProvider provider gas limit via RPC', () => {
  const params: IEstimateGasParams = {
    networkId: 'evm--8453',
    accountId: 'test',
    accountAddress: baseEncodedTx.from!,
    encodedTx: {
      ...baseEncodedTx,
      value: '0x1234',
      data: '0x123456',
      nonce: 7,
      chainId: '0x2105',
    },
  };

  const buildProvider = (networkId = params.networkId) => {
    const network = {
      feeMeta: { symbol: 'Gwei', decimals: 9, isWithL1BaseFee: true },
    } as IServerNetwork;
    const provider = new EvmApiProvider({
      url: 'https://rpc.example.invalid',
      networkId,
      backgroundApi: {
        serviceNetwork: { getNetwork: jest.fn().mockResolvedValue(network) },
      } as unknown as EvmApiProvider['backgroundApi'],
    });
    jest.spyOn(provider, 'getChainTokens').mockResolvedValue([
      {
        info: { symbol: 'ETH', decimals: 18, address: '', isNative: true },
        price: '2000',
        price24h: 0,
        fiatValue: '0',
        balance: '0',
        balanceParsed: '0',
      },
    ]);
    const gasPrice = jest.spyOn(provider, 'getGasPrice').mockResolvedValue({
      isEIP1559: true,
      gas: [{ gasPrice: '2' }, { gasPrice: '4' }],
      gasEIP1559: [
        { baseFeePerGas: '1', maxFeePerGas: '3', maxPriorityFeePerGas: '2' },
        { baseFeePerGas: '1', maxFeePerGas: '5', maxPriorityFeePerGas: '4' },
      ],
    });
    const gasFee = jest.spyOn(provider, 'getGasFee');
    const rpcCall = jest
      .spyOn(provider.client, 'call')
      .mockResolvedValue('0x89173700');
    const estimateGas = jest.spyOn(provider, 'getGasLimit').mockResolvedValue({
      gasLimit: '36000',
      estimateGasLimit: '30000',
    });
    return { provider, gasPrice, gasFee, rpcCall, estimateGas };
  };

  afterEach(() => jest.restoreAllMocks());

  it.each(
    [
      {
        networkId: 'evm--8453',
        chainId: '0x2105',
        oracleAddress: '0x420000000000000000000000000000000000000f',
      },
      {
        networkId: 'evm--534352',
        chainId: '0x82750',
        oracleAddress: '0x5300000000000000000000000000000000000002',
      },
    ].flatMap((network) =>
      ['240972', '2.40972e5'].map((gasLimit) => ({ ...network, gasLimit })),
    ),
  )(
    'normalizes $gasLimit and prices L1 through the correct oracle without estimating gas on $networkId',
    async ({ networkId, chainId, oracleAddress, gasLimit }) => {
      const { provider, gasPrice, gasFee, rpcCall, estimateGas } =
        buildProvider(networkId);
      const encodedTx = {
        ...(params.encodedTx as IEncodedTxEvm),
        chainId,
      };
      const result = await provider.estimateFeeFromRpc({
        ...params,
        networkId,
        encodedTx,
        gasLimit,
      });

      expect(gasPrice).toHaveBeenCalledTimes(1);
      expect(gasFee).toHaveBeenCalledWith({
        networkId,
        encodedTx: {
          ...encodedTx,
          gasLimit: '240972',
        },
      });
      expect(rpcCall).toHaveBeenCalledTimes(1);
      expect(rpcCall).toHaveBeenCalledWith('eth_call', [
        {
          to: oracleAddress,
          data: expect.stringMatching(/^0x/),
        },
        'latest',
      ]);
      expect(estimateGas).not.toHaveBeenCalled();
      expect(result.baseFee).toBe('3.45');
      expect(result.gas).toEqual([
        { gasPrice: '2', gasLimit: '240972', gasLimitForDisplay: '240972' },
        { gasPrice: '4', gasLimit: '240972', gasLimitForDisplay: '240972' },
      ]);
      expect(result.gasEIP1559).toEqual([
        {
          baseFeePerGas: '1',
          maxFeePerGas: '3',
          maxPriorityFeePerGas: '2',
          gasLimit: '240972',
          gasLimitForDisplay: '240972',
        },
        {
          baseFeePerGas: '1',
          maxFeePerGas: '5',
          maxPriorityFeePerGas: '4',
          gasLimit: '240972',
          gasLimitForDisplay: '240972',
        },
      ]);
      expect(encodedTx).not.toHaveProperty('gasLimit');
    },
  );

  it.each([undefined, '', '0', '-1', '1.5', 'NaN', 'Infinity'])(
    'keeps normal estimation for invalid or missing limit %s',
    async (gasLimit) => {
      const { provider, gasFee, estimateGas } = buildProvider();
      const result = await provider.estimateFeeFromRpc({
        ...params,
        gasLimit,
      });

      expect(estimateGas).toHaveBeenCalledWith({
        networkId: params.networkId,
        encodedTx: params.encodedTx,
      });
      expect(gasFee).toHaveBeenCalledWith({
        networkId: params.networkId,
        encodedTx: params.encodedTx,
      });
      expect(result.gas?.[0]).toMatchObject({
        gasLimit: '36000',
        gasLimitForDisplay: '30000',
      });
      expect(result.gasEIP1559?.[0]).toMatchObject({
        gasLimit: '36000',
        gasLimitForDisplay: '30000',
      });
    },
  );
});

describe('EvmVault.buildUnsignedTx nonce chaining', () => {
  it('assigns nonce prevNonce + 1 when prevNonce is 0', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
      prevNonce: 0,
    });
    expect(unsignedTx.nonce).toBe(1);
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBe(1);
  });

  it('assigns nonce prevNonce + 1 when prevNonce is positive', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
      prevNonce: 5,
    });
    expect(unsignedTx.nonce).toBe(6);
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBe(6);
  });

  it('leaves nonce unset when prevNonce is not provided', async () => {
    const vault = buildVault();
    const unsignedTx = await vault.buildUnsignedTx({
      encodedTx: { ...baseEncodedTx },
    });
    expect(unsignedTx.nonce).toBeUndefined();
    expect((unsignedTx.encodedTx as IEncodedTxEvm).nonce).toBeUndefined();
  });
});
