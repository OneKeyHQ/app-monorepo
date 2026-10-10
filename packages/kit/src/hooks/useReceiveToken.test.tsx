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
  default: {},
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
