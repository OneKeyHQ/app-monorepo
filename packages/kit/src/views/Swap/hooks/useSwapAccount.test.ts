/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from './useSwapAccount';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

const SOURCE_NETWORK = 'evm--42161';
const TARGET_NETWORK = 'tron--0x2b6653dc';
const mockGetNetworkAccount = jest.fn<
  Promise<INetworkAccount | undefined>,
  [{ networkId: string }]
>();
let mockSettings = { swapToAnotherAccountSwitchOn: false };
let mockRecipient: { address?: string; networkId?: string } = {};
let mockTargetNetwork = TARGET_NETWORK;
let mockAccounts: Record<number, IAccountSelectorActiveAccountInfo>;

function buildNetworkAccount(id: string, address: string): INetworkAccount {
  return { id, addressDetail: { address } } as INetworkAccount;
}

function buildActiveAccount(
  id: string,
  ready = true,
): IAccountSelectorActiveAccountInfo {
  return {
    ready,
    account: buildNetworkAccount(id, `${id}-address`),
    indexedAccount: undefined,
    dbAccount: undefined,
    accountName: '',
    wallet: undefined,
    device: undefined,
    network: {
      id: SOURCE_NETWORK,
    } as IAccountSelectorActiveAccountInfo['network'],
    vaultSettings: undefined,
    deriveType: 'default',
    deriveInfoItems: [],
  };
}

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [mockSettings, jest.fn()],
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: ({ num }: { num: number }) => ({
    activeAccount: mockAccounts[num],
  }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: async () => 'default',
    },
    serviceAccount: {
      getNetworkAccount: (params: { networkId: string }) =>
        mockGetNetworkAccount(params),
    },
  },
}));
jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapSelectFromTokenAtom: () => [{ networkId: SOURCE_NETWORK }],
  useSwapSelectToTokenAtom: () => [{ networkId: mockTargetNetwork }],
  useSwapSelectTokenNetworkAtom: () => [{}],
  useSwapTypeSwitchAtom: () => [ESwapTabSwitchType.SWAP],
  useSwapProDirectionAtom: () => ['buy'],
  useSwapProSelectTokenAtom: () => [undefined],
  useSwapProUseSelectBuyTokenAtom: () => [undefined],
  useSwapProSellToTokenAtom: () => [undefined],
  useSwapToAnotherAccountAddressAtom: () => [mockRecipient],
}));
jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: jest.fn(),
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: jest.fn(),
}));
jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType',
  () => ({
    ESwapDirection: { BUY: 'buy', SELL: 'sell' },
  }),
);

function renderAddressContexts() {
  return renderHook(() => ({
    execution: useSwapAddressInfo(ESwapDirectionType.TO),
    validation: useSwapAddressInfo(ESwapDirectionType.TO, {
      useCustomRecipientAddress: false,
    }),
  }));
}

describe('useSwapAddressInfo recipient validation context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = { swapToAnotherAccountSwitchOn: false };
    mockRecipient = {};
    mockTargetNetwork = TARGET_NETWORK;
    mockAccounts = {
      0: buildActiveAccount('source'),
      1: buildActiveAccount('recipient-slot', false),
    };
    mockGetNetworkAccount.mockResolvedValue(
      buildNetworkAccount('target', 'target-address'),
    );
  });

  it('keeps validation ready on the source account when publishing a custom recipient', async () => {
    const { result, rerender } = renderAddressContexts();
    await waitFor(() => {
      expect(result.current.validation.isAddressInfoReady).toBe(true);
    });
    expect(result.current.validation.accountInfo?.account?.id).toBe('target');

    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = {
      address: 'external-recipient',
      networkId: TARGET_NETWORK,
    };
    rerender();

    expect(result.current.execution.address).toBe('external-recipient');
    expect(result.current.validation.address).toBe('target-address');
    expect(result.current.validation.accountInfo?.account?.id).toBe('target');
    expect(result.current.validation.isAddressInfoReady).toBe(true);
    expect(mockGetNetworkAccount).toHaveBeenCalledTimes(1);
  });

  it('invalidates the validation context when the source account actually changes', async () => {
    const { result, rerender } = renderAddressContexts();
    await waitFor(() => {
      expect(result.current.validation.isAddressInfoReady).toBe(true);
    });
    mockAccounts[0] = buildActiveAccount('new-source');
    mockGetNetworkAccount.mockResolvedValue(
      buildNetworkAccount('new-target', 'new-target-address'),
    );
    rerender();

    expect(result.current.validation.isAddressInfoReady).toBe(false);
    await waitFor(() => {
      expect(result.current.validation.accountInfo?.account?.id).toBe(
        'new-target',
      );
      expect(result.current.validation.isAddressInfoReady).toBe(true);
    });
  });

  it('invalidates the validation context when the destination network actually changes', async () => {
    const { result, rerender } = renderAddressContexts();
    await waitFor(() => {
      expect(result.current.validation.isAddressInfoReady).toBe(true);
    });
    mockTargetNetwork = 'evm--1';
    mockGetNetworkAccount.mockResolvedValue(
      buildNetworkAccount('ethereum-target', 'ethereum-address'),
    );
    rerender();

    expect(result.current.validation.isAddressInfoReady).toBe(false);
    await waitFor(() => {
      expect(result.current.validation.networkId).toBe('evm--1');
      expect(result.current.validation.accountInfo?.account?.id).toBe(
        'ethereum-target',
      );
      expect(result.current.validation.isAddressInfoReady).toBe(true);
    });
  });
});
