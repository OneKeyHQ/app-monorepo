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
  it.each([
    [
      'sol--101',
      'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
      false,
      undefined,
    ],
    [
      'sol--101',
      'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
      true,
      undefined,
    ],
    [
      'ton--mainnet',
      'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      false,
      undefined,
    ],
    [
      'ton--mainnet',
      'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      true,
      undefined,
    ],
    ['evm--56', '0xabcdef', false, undefined],
    ['evm--56', '0xabcdef', true, undefined],
    ['evm--56', '0xabcdef', true, '1'],
  ] as const)(
    'rechecks Wallet amount metadata (%s, %s, account %s, Swap multiplier %s)',
    async (networkId, contractAddress, withAccount, swapMultiplier) => {
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
        balanceMultiplier: swapMultiplier,
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
          ...(networkId === 'evm--56'
            ? { requireFreshBalanceMultiplier: true }
            : { balanceMultiplier: '1' }),
          throwOnError: true,
        }),
      ).resolves.toEqual([
        {
          ...swapToken,
          balanceMultiplier: info.balanceMultiplier,
          balanceParsed: withAccount ? '10' : undefined,
        },
      ]);
      if (withAccount) {
        expect(fetchTokenInfoOnly).not.toHaveBeenCalled();
        expect(fetchTokensDetails).toHaveBeenCalledWith({
          accountId,
          networkId,
          contractList: [contractAddress],
          expectedAccountAddress: accountAddress,
          withFrozenBalance: true,
          withCheckInscription: false,
        });
      } else {
        expect(fetchTokenInfoOnly).toHaveBeenCalledWith({
          networkId,
          tokenAddress: contractAddress,
          forceRefresh: true,
        });
        expect(fetchTokensDetails).not.toHaveBeenCalled();
      }
      expect(get.mock.calls[0][1]?.params).not.toHaveProperty(
        'balanceMultiplier',
      );
      expect(get.mock.calls[0][1]?.params).not.toHaveProperty(
        'requireFreshBalanceMultiplier',
      );
    },
  );
  it.each([
    ['10', '1.6', false],
    [undefined, '1.6', false],
    ['10', '1', true],
    ['10', '0', true],
    ['10', undefined, true],
  ] as const)(
    'validates the Wallet raw balance and multiplier (balance %s, multiplier %s, fresh %s)',
    async (
      walletRawBalance,
      walletMultiplier,
      requireFreshBalanceMultiplier,
    ) => {
      const networkId = 'evm--56';
      const contractAddress = '0xabcdef';
      const accountAddress = '0xaccount';
      const accountId = 'account';
      const fetchTokensDetails = jest.fn().mockResolvedValue([
        {
          info: { networkId, address: contractAddress, decimals: 18 },
          balanceParsed: walletRawBalance,
          balanceMultiplier: walletMultiplier,
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
        requireFreshBalanceMultiplier,
        throwOnError: true,
      });

      if (walletRawBalance === undefined) {
        await expect(operation).rejects.toThrow(
          'Scaled token balance is unavailable',
        );
      } else if (walletMultiplier === undefined || walletMultiplier === '0') {
        await expect(operation).rejects.toThrow(
          'Swap token balance multiplier is invalid',
        );
      } else {
        await expect(operation).resolves.toEqual([
          {
            ...swapToken,
            balanceParsed: '10',
            balanceMultiplier: walletMultiplier,
          },
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
