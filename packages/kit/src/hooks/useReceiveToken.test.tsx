/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IToken } from '@onekeyhq/shared/types/token';

import { useReceiveToken } from './useReceiveToken';

const mockPush = jest.fn();
const mockPushModal = jest.fn();
let mockVaultSettings: {
  isSingleToken?: boolean;
  mergeDeriveAssetsEnabled?: boolean;
} = {};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush, pushModal: mockPushModal }),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, key: string) => key }),
}));

jest.mock('@onekeyhq/shared/src/routes', () => ({
  EModalReceiveRoutes: {
    ReceiveToken: 'ReceiveToken',
    ReceiveSelector: 'ReceiveSelector',
    ReceiveSelectToken: 'ReceiveSelectToken',
    ReceiveSelectAggregateToken: 'ReceiveSelectAggregateToken',
    CreateInvoice: 'CreateInvoice',
  },
  EModalRoutes: { ReceiveModal: 'ReceiveModal' },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isOthersWallet: () => false },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
    isLightningNetworkByNetworkId: () => false,
  },
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: { getVaultSettings: jest.fn(async () => ({})) },
  },
}));

jest.mock('../views/Receive/components/ReceiveNetworkList', () => ({
  buildReceiveNetworkSecondaryTab: jest.fn(),
}));

jest.mock('./useAccountData', () => ({
  useAccountData: () => ({
    vaultSettings: mockVaultSettings,
    account: undefined,
    network: undefined,
    wallet: undefined,
  }),
}));

const TOKEN = { address: '', symbol: 'BTC', isNative: true } as IToken;

function renderReceive(
  overrides: Partial<Parameters<typeof useReceiveToken>[0]> = {},
) {
  return renderHook(() =>
    useReceiveToken({
      accountId: 'hd-1--btc',
      networkId: 'btc--0',
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      ...overrides,
    }),
  );
}

describe('useReceiveToken direct-to-QR switch opt-in', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockPushModal.mockReset();
    mockVaultSettings = {};
  });

  it('forwards the opt-in on the multi-derive path under All Networks', async () => {
    mockVaultSettings = { mergeDeriveAssetsEnabled: true };
    const { result } = renderReceive({
      isAllNetworks: true,
      isMultipleDerive: true,
    });

    await act(async () => {
      await result.current.handleOnReceive({
        token: TOKEN,
        switchEntry: 'token',
      });
    });
    expect(mockPushModal).toHaveBeenCalledWith('ReceiveModal', {
      screen: 'ReceiveToken',
      // The derive-type selector needs an empty account id.
      params: expect.objectContaining({
        accountId: '',
        switchEntry: 'token',
        isAllNetworksMode: true,
      }),
    });

    await act(async () => {
      await result.current.handleOnReceive({
        token: TOKEN,
        switchEntry: 'token',
        sameModal: true,
      });
    });
    expect(mockPush).toHaveBeenCalledWith(
      'ReceiveToken',
      expect.objectContaining({
        accountId: '',
        switchEntry: 'token',
        isAllNetworksMode: true,
      }),
    );
  });

  it('drops the opt-in in single-network mode on both direct paths', async () => {
    mockVaultSettings = { mergeDeriveAssetsEnabled: true };
    const multiDerive = renderReceive({ isMultipleDerive: true });
    await act(async () => {
      await multiDerive.result.current.handleOnReceive({
        token: TOKEN,
        switchEntry: 'token',
      });
    });
    expect(mockPushModal).toHaveBeenLastCalledWith('ReceiveModal', {
      screen: 'ReceiveToken',
      params: expect.objectContaining({
        accountId: '',
        switchEntry: undefined,
        isAllNetworksMode: false,
      }),
    });

    mockVaultSettings = {};
    const plain = renderReceive();
    await act(async () => {
      await plain.result.current.handleOnReceive({
        token: TOKEN,
        switchEntry: 'token',
      });
    });
    expect(mockPushModal).toHaveBeenLastCalledWith('ReceiveModal', {
      screen: 'ReceiveToken',
      params: expect.objectContaining({
        accountId: 'hd-1--btc',
        switchEntry: undefined,
        isAllNetworksMode: false,
      }),
    });
  });
});

describe('useReceiveToken token list selection', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockPushModal.mockReset();
    mockVaultSettings = {};
  });

  it('leaves the group of a row picked without group context for the QR page to resolve', async () => {
    const { result } = renderReceive({
      networkId: 'onekeyall--0',
      accountId: 'hd-1--all',
    });
    await act(async () => {
      await result.current.handleOnReceive({});
    });
    expect(mockPushModal).toHaveBeenCalledWith('ReceiveModal', {
      screen: 'ReceiveSelectToken',
      params: expect.objectContaining({ enableCrossNetworkSearch: true }),
    });
    const { params } = mockPushModal.mock.calls[0][1] as {
      params: { onSelect: (token: IToken) => Promise<void> };
    };

    // A search result under All Networks: one member of a multi-chain token,
    // listed as a plain per-network row.
    await act(async () => {
      await params.onSelect({
        networkId: 'tron--0x2b6653dc',
        accountId: 'hd-1--tron',
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        symbol: 'USDT',
        isNative: false,
      } as IToken);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const [screen, pushed] = mockPush.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(screen).toBe('ReceiveToken');
    expect(pushed).toEqual(
      expect.objectContaining({
        networkId: 'tron--0x2b6653dc',
        accountId: 'hd-1--tron',
        switchEntry: 'token',
        isAllNetworksMode: true,
      }),
    );
    // No member list travels with it, and nothing tells the page to skip
    // looking the group up.
    expect(pushed.allAggregateTokenList).toBeUndefined();
    expect(pushed).not.toHaveProperty('skipAggregateLookup');
  });
});
