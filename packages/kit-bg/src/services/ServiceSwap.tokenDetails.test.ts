import axios from 'axios';

import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import ServiceSwap from './ServiceSwap';

describe('ServiceSwap token detail errors', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  beforeEach(() => {
    jest.spyOn(travelModeManager, 'isActive').mockResolvedValue(false);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it.each([false, true])(
    'retains request errors only when requested (%s)',
    async (throwOnError) => {
      const service = new ServiceSwap({ backgroundApi: {} });
      const error = {
        className: 'OneKeyServerApiError',
        message: 'Token detail unavailable',
      };
      jest.spyOn(service, 'getClient').mockRejectedValueOnce(error);
      const operation = service.fetchSwapTokenDetails({
        networkId: 'evm--1',
        contractAddress: '0xtoken',
        throwOnError,
      });
      if (throwOnError) {
        await expect(operation).rejects.toBe(error);
      } else {
        await expect(operation).resolves.toEqual([]);
      }
    },
  );
  it.each([false, true])(
    'resolves missing Solana scaling metadata from Wallet (with account: %s)',
    async (withAccount) => {
      const networkId = 'sol--101';
      const contractAddress = 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh';
      const accountAddress = 'account-address';
      const accountId = 'account-id';
      const info = {
        address: contractAddress,
        networkId,
        decimals: 8,
        balanceMultiplier: '1.001701196801074',
      };
      const fetchTokenInfoOnly = jest.fn().mockResolvedValue({ info });
      const fetchTokensDetails = jest.fn().mockResolvedValue([
        {
          info,
          balanceParsed: '10',
          balanceMultiplier: info.balanceMultiplier,
        },
      ]);
      const service = new ServiceSwap({
        backgroundApi: {
          serviceToken: { fetchTokenInfoOnly, fetchTokensDetails },
          serviceAccount: {
            getAccountAddressForApi: jest
              .fn()
              .mockResolvedValue(accountAddress),
            getAccountXpub: jest.fn().mockResolvedValue(undefined),
          },
          serviceAccountProfile: {
            _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
          },
          serviceSetting: {
            getEffectiveInscriptionProtection: jest
              .fn()
              .mockResolvedValue(false),
          },
        },
      });
      const client = axios.create();
      const swapToken = {
        networkId,
        contractAddress,
        decimals: 8,
        balanceParsed: '10.01701196801074',
      };
      const get = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: { data: [swapToken] } });
      jest.spyOn(service, 'getClient').mockResolvedValue(client);
      await expect(
        service.fetchSwapTokenDetails({
          networkId,
          contractAddress,
          ...(withAccount ? { accountAddress, accountId } : {}),
          throwOnError: true,
        }),
      ).resolves.toEqual([
        {
          ...swapToken,
          balanceMultiplier: info.balanceMultiplier,
          balanceParsed: withAccount ? '10' : undefined,
        },
      ]);
      expect(fetchTokenInfoOnly).toHaveBeenCalledWith({
        networkId,
        tokenAddress: contractAddress,
      });
      expect(fetchTokensDetails).toHaveBeenCalledTimes(withAccount ? 1 : 0);
      expect(get.mock.calls[0][1]?.params).not.toHaveProperty(
        'balanceMultiplier',
      );
    },
  );
  it.each(['10', undefined])(
    'uses only an account-bound Wallet raw balance for a known scaled token (%s)',
    async (walletRawBalance) => {
      const networkId = 'evm--56';
      const contractAddress = '0xabcdef';
      const accountAddress = '0xaccount';
      const accountId = 'account';
      const fetchTokensDetails = jest.fn().mockResolvedValue([
        {
          info: { networkId, address: contractAddress, decimals: 18 },
          balanceParsed: walletRawBalance,
          balanceMultiplier: '1.6',
        },
      ]);
      const service = new ServiceSwap({
        backgroundApi: {
          serviceToken: { fetchTokensDetails },
          serviceAccount: {
            getAccountAddressForApi: jest
              .fn()
              .mockResolvedValue(accountAddress),
            getAccountXpub: jest.fn().mockResolvedValue(undefined),
          },
          serviceAccountProfile: {
            _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
          },
          serviceSetting: {
            getEffectiveInscriptionProtection: jest
              .fn()
              .mockResolvedValue(false),
          },
        },
      });
      const client = axios.create();
      const swapToken = {
        networkId,
        contractAddress,
        decimals: 18,
        balanceParsed: '15',
      };
      const get = jest
        .spyOn(client, 'get')
        .mockResolvedValue({ data: { data: [swapToken] } });
      jest.spyOn(service, 'getClient').mockResolvedValue(client);
      const operation = service.fetchSwapTokenDetails({
        networkId,
        contractAddress,
        accountId,
        accountAddress,
        balanceMultiplier: '1.5',
        throwOnError: true,
      });

      if (walletRawBalance === undefined) {
        await expect(operation).rejects.toThrow(
          'Scaled token balance is unavailable',
        );
      } else {
        await expect(operation).resolves.toEqual([
          { ...swapToken, balanceParsed: '10', balanceMultiplier: '1.6' },
        ]);
      }
      expect(fetchTokensDetails).toHaveBeenCalledWith({
        accountId,
        networkId,
        contractList: [contractAddress],
        expectedAccountAddress: accountAddress,
        withFrozenBalance: true,
        withCheckInscription: false,
      });
      expect(get.mock.calls[0][1]?.params).not.toHaveProperty(
        'balanceMultiplier',
      );
    },
  );
});
