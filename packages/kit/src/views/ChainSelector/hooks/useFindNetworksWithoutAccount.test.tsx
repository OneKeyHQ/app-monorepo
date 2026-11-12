/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useFindNetworksWithoutAccount } from './useFindNetworksWithoutAccount';

import type { IServerNetworkMatch } from '../types';

const mockGetAccounts = jest.fn<
  Promise<{ accountsInfo: IAllNetworkAccountInfo[] }>,
  [
    {
      accountId: string;
      indexedAccountId: string | undefined;
      networkId: string;
    },
  ]
>();
const mockGetDeriveType = jest.fn<
  Promise<IAccountDeriveTypes>,
  [{ networkId: string }]
>();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      getAllNetworkAccounts: (params: Parameters<typeof mockGetAccounts>[0]) =>
        mockGetAccounts(params),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (params: { networkId: string }) =>
        mockGetDeriveType(params),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall' }),
}));

const selectedNetworks = [
  { id: 'evm--1' },
  { id: 'btc--0' },
] as IServerNetworkMatch[];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDeriveType.mockImplementation(async ({ networkId }) =>
    networkId === 'btc--0' ? 'BIP86' : 'default',
  );
  mockGetAccounts.mockImplementation(
    async ({ accountId, indexedAccountId }) => {
      if (!accountId && !indexedAccountId)
        throw new OneKeyLocalError('indexedAccountId is required');
      return { accountsInfo: [] };
    },
  );
});

it('treats an empty wallet as missing all selected addresses without an invalid background lookup', async () => {
  const { result } = renderHook(() => useFindNetworksWithoutAccount());
  await expect(
    result.current.findNetworksWithoutAccount({
      accountId: '',
      indexedAccountId: undefined,
      enabledNetworks: selectedNetworks,
    }),
  ).resolves.toEqual([
    { networkId: 'evm--1', deriveType: 'default' },
    { networkId: 'btc--0', deriveType: 'BIP86' },
  ]);
  expect(mockGetAccounts).not.toHaveBeenCalled();
  expect(
    mockGetDeriveType.mock.calls.map(([params]) => params.networkId),
  ).toEqual(['evm--1', 'btc--0']);
});

it('still reads existing accounts and respects each selected network’s global derivation', async () => {
  mockGetAccounts.mockResolvedValue({
    accountsInfo: [
      {
        networkId: 'evm--1',
        deriveType: 'default',
        dbAccount: { id: 'hd-wallet--evm' },
      },
      {
        networkId: 'btc--0',
        deriveType: 'BIP84',
        dbAccount: { id: 'hd-wallet--btc' },
      },
    ] as IAllNetworkAccountInfo[],
  });
  const { result } = renderHook(() => useFindNetworksWithoutAccount());
  await expect(
    result.current.findNetworksWithoutAccount({
      accountId: '',
      indexedAccountId: 'hd-wallet--0',
      enabledNetworks: selectedNetworks,
    }),
  ).resolves.toEqual([{ networkId: 'btc--0', deriveType: 'BIP86' }]);
  expect(mockGetAccounts).toHaveBeenCalledWith(
    expect.objectContaining({
      indexedAccountId: 'hd-wallet--0',
      networkId: 'onekeyall',
    }),
  );
});
