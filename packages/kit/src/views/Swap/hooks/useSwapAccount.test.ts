/** @jest-environment jsdom */

import type { SetStateAction } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IQueryCheckAddressArgs } from '@onekeyhq/shared/types/address';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from './useSwapAccount';
import { getSwapRecipientValidationAccountId } from './useSwapAccount.utils';
import {
  shouldBlockSwapActionForIncognitoRecipientInput,
  shouldEnableSwapIncognitoRecipientValidation,
  useSwapIncognitoRecipientInput,
} from './useSwapIncognitoRecipientInput';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

const SOURCE_NETWORK = 'evm--42161';
const TARGET_NETWORK = 'tron--0x2b6653dc';
const mockGetDeriveType = jest.fn<Promise<IAccountDeriveTypes>, []>();
const mockSetSettings = jest.fn();
const mockSetRecipient = jest.fn();
const mockQueryAddress = jest.fn<
  Promise<IAddressQueryResult>,
  [IQueryCheckAddressArgs]
>();
const mockGetNetworkAccount = jest.fn<
  Promise<INetworkAccount | undefined>,
  [{ networkId: string; accountId?: string }]
>();
let mockSettings = { swapToAnotherAccountSwitchOn: false };
type IRecipientState = {
  address?: string;
  networkId?: string;
  accountInfo?: IAccountSelectorActiveAccountInfo;
};
let mockRecipient: IRecipientState = {};
let mockTargetNetwork = TARGET_NETWORK;
let mockHasToToken = true;
let mockSelectorNetwork: { networkId?: string } = {};
let mockSwapTab: ESwapTabSwitchType = ESwapTabSwitchType.SWAP;
let mockProToken: { networkId: string } | undefined;
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
  useSettingsAtom: () => [mockSettings, mockSetSettings],
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
      getGlobalDeriveTypeOfNetwork: () => mockGetDeriveType(),
    },
    serviceAccount: {
      getNetworkAccount: (params: { networkId: string; accountId?: string }) =>
        mockGetNetworkAccount(params),
    },
  },
}));
jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapSelectFromTokenAtom: () => [{ networkId: SOURCE_NETWORK }],
  useSwapSelectToTokenAtom: () => [
    mockHasToToken ? { networkId: mockTargetNetwork } : undefined,
  ],
  useSwapSelectTokenNetworkAtom: () => [mockSelectorNetwork],
  useSwapTypeSwitchAtom: () => [mockSwapTab],
  useSwapProDirectionAtom: () => ['buy'],
  useSwapProSelectTokenAtom: () => [mockProToken],
  useSwapProUseSelectBuyTokenAtom: () => [undefined],
  useSwapProSellToTokenAtom: () => [undefined],
  useSwapToAnotherAccountAddressAtom: () => [mockRecipient, mockSetRecipient],
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/components/AddressInput/utils', () => ({
  getAddressQueryResolvedAddress: (result: IAddressQueryResult) =>
    result.resolveAddress ?? result.validAddress,
  getAddressValidateTranslationId: () => undefined,
  queryAddressWithFallback: (params: IQueryCheckAddressArgs) =>
    mockQueryAddress(params),
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

function renderRecipientValidation() {
  return renderHook(() => {
    const validation = useSwapAddressInfo(ESwapDirectionType.TO, {
      useCustomRecipientAddress: false,
    });
    const execution = useSwapAddressInfo(ESwapDirectionType.TO);
    const input = useSwapIncognitoRecipientInput({
      visible: true,
      validationEnabled: shouldEnableSwapIncognitoRecipientValidation({
        visible: true,
        hasFromToken: true,
        hasToToken: true,
        providerSupportsRecipient: true,
        networkId: validation.networkId,
        isAddressInfoReady: validation.isRecipientValidationReady,
      }),
      networkId: validation.networkId,
      validationScopeKey: validation.validationScopeKey,
      accountId: getSwapRecipientValidationAccountId({
        accountId: validation.accountInfo?.account?.id,
        accountAddress: validation.accountInfo?.account?.addressDetail?.address,
        recipientAddress: validation.address,
      }),
      accountInfo: validation.accountInfo,
      address: mockRecipient.address,
      swapToAnotherAccountSwitchOn: mockSettings.swapToAnotherAccountSwitchOn,
    });
    return { validation, execution, input };
  });
}

describe('useSwapAddressInfo recipient validation context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeriveType.mockReset().mockResolvedValue('default');
    mockSetSettings.mockImplementation(
      (updater: SetStateAction<typeof mockSettings>) => {
        mockSettings =
          typeof updater === 'function' ? updater(mockSettings) : updater;
      },
    );
    mockSetRecipient.mockImplementation(
      (updater: SetStateAction<IRecipientState>) => {
        mockRecipient =
          typeof updater === 'function' ? updater(mockRecipient) : updater;
      },
    );
    mockQueryAddress.mockReset().mockResolvedValue({
      validStatus: 'valid',
      validAddress: 'external-recipient',
    });
    mockSettings = { swapToAnotherAccountSwitchOn: false };
    mockRecipient = {};
    mockTargetNetwork = TARGET_NETWORK;
    mockHasToToken = true;
    mockSelectorNetwork = {};
    mockSwapTab = ESwapTabSwitchType.SWAP;
    mockProToken = undefined;
    Object.assign(platformEnv, { isNative: false });
    mockAccounts = {
      0: buildActiveAccount('source'),
      1: buildActiveAccount('recipient-slot', false),
    };
    mockGetNetworkAccount.mockResolvedValue(
      buildNetworkAccount('target', 'target-address'),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.assign(platformEnv, { isNative: false });
  });

  it('preserves the prior custom recipient on native LIMIT when the active account network remains compatible', () => {
    Object.assign(platformEnv, { isNative: true });
    mockSwapTab = ESwapTabSwitchType.LIMIT;
    mockProToken = { networkId: 'sol--101' };
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = { address: 'synthetic-evm-recipient', networkId: 'evm--1' };
    mockAccounts[1] = buildActiveAccount('native-recipient-slot');

    const { result } = renderHook(() =>
      useSwapAddressInfo(ESwapDirectionType.TO),
    );
    expect(result.current.networkId).toBe('sol--101');
    expect(result.current.address).toBe('synthetic-evm-recipient');
  });

  it('preserves the prior TO slot fallback on native LIMIT when the custom recipient is incompatible', async () => {
    Object.assign(platformEnv, { isNative: true });
    mockSwapTab = ESwapTabSwitchType.LIMIT;
    mockProToken = { networkId: 'sol--101' };
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = {
      address: 'synthetic-tron-recipient',
      networkId: 'tron--0x2b6653dc',
    };
    mockAccounts[1] = buildActiveAccount('native-recipient-slot');
    mockGetNetworkAccount.mockResolvedValue(
      buildNetworkAccount(
        'native-target-slot',
        'synthetic-target-slot-address',
      ),
    );

    const { result } = renderHook(() =>
      useSwapAddressInfo(ESwapDirectionType.TO),
    );
    await waitFor(() => {
      expect(result.current.address).toBe('synthetic-target-slot-address');
    });
    expect(result.current.networkId).toBe('sol--101');
  });

  it('preserves the prior custom recipient on native LIMIT without a selected Pro token', () => {
    Object.assign(platformEnv, { isNative: true });
    mockSwapTab = ESwapTabSwitchType.LIMIT;
    mockProToken = undefined;
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = { address: 'synthetic-evm-recipient', networkId: 'evm--1' };
    mockAccounts[1] = buildActiveAccount('native-recipient-slot');

    const { result } = renderHook(() =>
      useSwapAddressInfo(ESwapDirectionType.TO),
    );
    expect(result.current.address).toBe('synthetic-evm-recipient');
    expect(result.current.networkId).toBe(SOURCE_NETWORK);
  });

  it('does not use an all-network account as a compatible custom recipient network on native LIMIT', () => {
    Object.assign(platformEnv, { isNative: true });
    mockSwapTab = ESwapTabSwitchType.LIMIT;
    mockProToken = undefined;
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = { address: 'synthetic-evm-recipient', networkId: 'evm--1' };
    mockAccounts[1] = {
      ...buildActiveAccount('native-all-network-slot'),
      network: {
        id: 'onekeyall--0',
      } as IAccountSelectorActiveAccountInfo['network'],
    };

    const { result } = renderHook(() =>
      useSwapAddressInfo(ESwapDirectionType.TO),
    );
    expect(result.current.address).toBe('native-all-network-slot-address');
    expect(result.current.address).not.toBe('synthetic-evm-recipient');
  });

  it('does not expose a previous network account when returning to the active account network', async () => {
    const otherNetwork = 'evm--1';
    const recipientAddress = '0xsynthetic-recipient';
    const observed: Array<{ address?: string; accountId?: string }> = [];
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = { address: recipientAddress, networkId: otherNetwork };
    mockAccounts[1] = {
      ...buildActiveAccount('active-owner'),
      account: buildNetworkAccount('active-owner', recipientAddress),
    };
    mockTargetNetwork = otherNetwork;
    mockGetNetworkAccount.mockResolvedValue(
      buildNetworkAccount('other-network-account', recipientAddress),
    );
    const { result, rerender } = renderHook(() => {
      const info = useSwapAddressInfo(ESwapDirectionType.TO);
      observed.push({
        address: info.address,
        accountId: info.accountInfo?.account?.id,
      });
      return info;
    });
    await waitFor(() => {
      expect(result.current.accountInfo?.account?.id).toBe(
        'other-network-account',
      );
    });

    observed.length = 0;
    mockTargetNetwork = SOURCE_NETWORK;
    rerender();

    expect(observed.length).toBeGreaterThan(0);
    expect(observed).toEqual(
      observed.map(() => ({
        address: recipientAddress,
        accountId: 'active-owner',
      })),
    );
    expect(result.current.networkId).toBe(SOURCE_NETWORK);
  });

  it('does not expose a previous network account for an incompatible recipient when returning to the active network', async () => {
    const otherNetwork = 'evm--1';
    const observed: Array<{ address?: string; accountId?: string }> = [];
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = {
      address: 'synthetic-sol-recipient',
      networkId: 'sol--101',
    };
    mockAccounts[1] = buildActiveAccount('active-owner');
    mockTargetNetwork = otherNetwork;
    mockGetNetworkAccount.mockResolvedValue(
      buildNetworkAccount('other-network-account', 'other-network-address'),
    );
    const { result, rerender } = renderHook(() => {
      const info = useSwapAddressInfo(ESwapDirectionType.TO);
      observed.push({
        address: info.address,
        accountId: info.accountInfo?.account?.id,
      });
      return info;
    });
    await waitFor(() => {
      expect(result.current.accountInfo?.account?.id).toBe(
        'other-network-account',
      );
    });
    expect(result.current.address).toBeUndefined();

    observed.length = 0;
    mockTargetNetwork = SOURCE_NETWORK;
    rerender();

    expect(observed.length).toBeGreaterThan(0);
    expect(observed).toEqual(
      observed.map(() => ({ address: undefined, accountId: 'active-owner' })),
    );
    expect(result.current.networkId).toBe(SOURCE_NETWORK);
  });

  it('does not expose the previous network account for the same confirmed recipient while the new network resolves', async () => {
    const networkA = 'evm--1';
    const networkB = 'evm--10';
    const recipientAddress = '0xsynthetic-recipient';
    let resolveA: (account: INetworkAccount) => void = () => {
      throw new OneKeyLocalError('Network A resolver was not initialized');
    };
    let resolveB: (account: INetworkAccount) => void = () => {
      throw new OneKeyLocalError('Network B resolver was not initialized');
    };
    const requestA = new Promise<INetworkAccount>((resolve) => {
      resolveA = resolve;
    });
    const requestB = new Promise<INetworkAccount>((resolve) => {
      resolveB = resolve;
    });
    mockGetNetworkAccount.mockImplementation(({ networkId }) =>
      networkId === networkA ? requestA : requestB,
    );
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = { address: recipientAddress, networkId: networkA };
    mockAccounts[1] = buildActiveAccount('network-race-owner');
    mockTargetNetwork = networkA;
    const { result, rerender } = renderHook(() =>
      useSwapAddressInfo(ESwapDirectionType.TO),
    );
    await waitFor(() => {
      expect(mockGetNetworkAccount).toHaveBeenCalledWith(
        expect.objectContaining({ networkId: networkA }),
      );
    });
    await act(async () => {
      resolveA(buildNetworkAccount('network-a-account', recipientAddress));
      await requestA;
    });
    await waitFor(() => {
      expect(result.current.accountInfo?.account?.id).toBe('network-a-account');
    });

    mockTargetNetwork = networkB;
    rerender();
    try {
      expect(result.current.address).toBe(recipientAddress);
      expect(result.current.accountInfo?.account?.id).toBeUndefined();
    } finally {
      await act(async () => {
        resolveB(buildNetworkAccount('network-b-account', recipientAddress));
        await requestB;
      });
    }
    await waitFor(() => {
      expect(result.current.accountInfo?.account?.id).toBe('network-b-account');
    });
    expect(result.current.address).toBe(recipientAddress);
  });

  it('ignores an old recipient account lookup after the selected account changes', async () => {
    const targetNetwork = 'evm--1';
    const recipientAddress = '0xsynthetic-account-switch';
    let resolveOld: (account: INetworkAccount) => void = () => {
      throw new OneKeyLocalError('Old account resolver was not initialized');
    };
    let resolveNew: (account: INetworkAccount) => void = () => {
      throw new OneKeyLocalError('New account resolver was not initialized');
    };
    const oldRequest = new Promise<INetworkAccount>((resolve) => {
      resolveOld = resolve;
    });
    const newRequest = new Promise<INetworkAccount>((resolve) => {
      resolveNew = resolve;
    });
    mockGetNetworkAccount.mockImplementation(({ accountId }) =>
      accountId === 'old-recipient-owner' ? oldRequest : newRequest,
    );
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = { address: recipientAddress, networkId: targetNetwork };
    mockAccounts[1] = buildActiveAccount('old-recipient-owner');
    mockTargetNetwork = targetNetwork;
    const { result, rerender } = renderHook(() =>
      useSwapAddressInfo(ESwapDirectionType.TO),
    );
    await waitFor(() => {
      expect(mockGetNetworkAccount).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'old-recipient-owner' }),
      );
    });
    mockAccounts[1] = buildActiveAccount('new-recipient-owner');
    rerender();
    await waitFor(() => {
      expect(mockGetNetworkAccount).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'new-recipient-owner' }),
      );
    });
    await act(async () => {
      resolveOld(buildNetworkAccount('old-target-account', recipientAddress));
      await oldRequest;
    });
    try {
      expect(result.current.address).toBe(recipientAddress);
      expect(result.current.accountInfo?.account?.id).toBeUndefined();
    } finally {
      await act(async () => {
        resolveNew(buildNetworkAccount('new-target-account', recipientAddress));
        await newRequest;
      });
    }
    await waitFor(() => {
      expect(result.current.accountInfo?.account?.id).toBe(
        'new-target-account',
      );
    });
  });

  it.each(['pending', 'resolved'] as const)(
    'does not use a saved Solana recipient for an EVM target while account resolution is %s',
    async (resolution) => {
      const savedNetwork = 'sol--101';
      const savedRecipient = 'synthetic-sol-recipient';
      const nextNetwork = 'evm--1';
      let resolveNetworkAccount: (account: INetworkAccount) => void = () => {
        throw new OneKeyLocalError(
          'Network account resolver was not initialized',
        );
      };
      const pendingNetworkAccount = new Promise<INetworkAccount>((resolve) => {
        resolveNetworkAccount = resolve;
      });
      mockGetNetworkAccount.mockReturnValue(pendingNetworkAccount);
      mockSettings = { swapToAnotherAccountSwitchOn: true };
      mockRecipient = { address: savedRecipient, networkId: savedNetwork };
      mockAccounts[0] = buildActiveAccount(`source-${resolution}`);
      mockAccounts[1] = {
        ...buildActiveAccount(`recipient-slot-${resolution}`),
        network: {
          id: savedNetwork,
        } as IAccountSelectorActiveAccountInfo['network'],
      };
      mockTargetNetwork = savedNetwork;
      const { result, rerender } = renderAddressContexts();
      expect(result.current.execution.address).toBe(savedRecipient);

      mockTargetNetwork = nextNetwork;
      rerender();
      await waitFor(() => {
        expect(mockGetNetworkAccount).toHaveBeenCalledWith(
          expect.objectContaining({ networkId: nextNetwork }),
        );
      });
      const completeLookup = async () => {
        await act(async () => {
          resolveNetworkAccount(
            buildNetworkAccount('target-recipient-slot', 'other-evm-address'),
          );
          await pendingNetworkAccount;
        });
      };
      try {
        if (resolution === 'resolved') await completeLookup();
        expect(result.current.execution.address).toBeUndefined();
        expect(mockRecipient).toEqual({
          address: savedRecipient,
          networkId: savedNetwork,
        });
        mockTargetNetwork = savedNetwork;
        rerender();
        expect(result.current.execution.address).toBe(savedRecipient);
        if (resolution === 'resolved') {
          await waitFor(() => {
            expect(result.current.validation.isAddressInfoReady).toBe(true);
          });
        }
      } finally {
        if (resolution === 'pending') await completeLookup();
      }
    },
  );

  it('uses the execution token network by default while allowing selector-scoped lookups', async () => {
    const tokenNetwork = 'evm--1';
    const selectorNetwork = 'sol--101';
    mockTargetNetwork = tokenNetwork;
    mockSelectorNetwork = { networkId: selectorNetwork };
    mockGetNetworkAccount.mockImplementation(async ({ networkId }) =>
      buildNetworkAccount(`account-${networkId}`, `address-${networkId}`),
    );
    const { result } = renderHook(() => ({
      execution: useSwapAddressInfo(ESwapDirectionType.TO),
      selector: useSwapAddressInfo(ESwapDirectionType.TO, {
        networkScope: 'selector',
      }),
    }));

    await waitFor(() => {
      expect(result.current.execution.isAddressInfoReady).toBe(true);
      expect(result.current.selector.isAddressInfoReady).toBe(true);
    });
    expect(result.current.execution.networkId).toBe(tokenNetwork);
    expect(result.current.execution.address).toBe(`address-${tokenNetwork}`);
    expect(result.current.selector.networkId).toBe(selectorNetwork);
    expect(result.current.selector.address).toBe(`address-${selectorNetwork}`);
  });

  it.each([
    ['address', { networkId: 'sol--101' }],
    ['network', { address: 'synthetic-sol-recipient' }],
    ['address and network', {}],
  ] as const)(
    'does not fall back to a recipient slot address when the saved %s is missing',
    async (_missing, recipient) => {
      mockSettings = { swapToAnotherAccountSwitchOn: true };
      mockRecipient = recipient;
      mockAccounts[1] = buildActiveAccount(`incomplete-${_missing}`);
      mockTargetNetwork = 'evm--1';
      mockGetNetworkAccount.mockResolvedValue(
        buildNetworkAccount('recipient-target', 'other-evm-address'),
      );

      const { result } = renderAddressContexts();
      expect(result.current.execution.address).toBeUndefined();
      await waitFor(() => {
        expect(result.current.execution.isAddressInfoReady).toBe(true);
      });
      expect(result.current.execution.address).toBeUndefined();
      expect(mockRecipient).toEqual(recipient);
    },
  );

  it('does not use a saved recipient or selector network while the destination token is unavailable', async () => {
    const savedNetwork = 'sol--101';
    const savedRecipient = 'synthetic-sol-recipient';
    mockSettings = { swapToAnotherAccountSwitchOn: true };
    mockRecipient = { address: savedRecipient, networkId: savedNetwork };
    mockAccounts[1] = {
      ...buildActiveAccount('recipient-slot-no-token'),
      network: {
        id: savedNetwork,
      } as IAccountSelectorActiveAccountInfo['network'],
    };
    mockSelectorNetwork = { networkId: savedNetwork };
    mockHasToToken = false;
    const { result, rerender } = renderAddressContexts();
    expect(result.current.execution.address).toBeUndefined();
    expect(result.current.execution.networkId).toBeUndefined();
    expect(result.current.execution.isAddressInfoReady).toBe(false);
    expect(mockRecipient).toEqual({
      address: savedRecipient,
      networkId: savedNetwork,
    });

    mockTargetNetwork = savedNetwork;
    mockHasToToken = true;
    rerender();
    expect(result.current.execution.address).toBe(savedRecipient);
    await waitFor(() => {
      expect(result.current.validation.isAddressInfoReady).toBe(true);
    });
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

  it('validates an external recipient after the derive retry fails without making execution ready', async () => {
    jest.useFakeTimers();
    mockGetDeriveType.mockRejectedValue(new Error('derive lookup failed'));
    const { result } = renderRecipientValidation();
    const scope = result.current.validation.validationScopeKey;
    act(() => result.current.input.onInputChange('external-recipient'));

    await act(async () => jest.advanceTimersByTimeAsync(499));
    expect(result.current.validation.isRecipientValidationReady).toBe(false);
    expect(mockQueryAddress).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTimeAsync(1));
    expect(mockGetDeriveType).toHaveBeenCalledTimes(2);
    expect(result.current.validation.isRecipientValidationReady).toBe(true);
    expect(result.current.validation.isAddressInfoReady).toBe(false);
    expect(result.current.execution.isAddressInfoReady).toBe(false);

    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(mockQueryAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        address: 'external-recipient',
        networkId: TARGET_NETWORK,
        accountId: undefined,
        enableAddressInteractionStatus: true,
        enableAllowListValidation: true,
      }),
    );
    expect(mockRecipient.address).toBe('external-recipient');
    expect(result.current.execution.address).toBe('external-recipient');
    expect(result.current.validation.validationScopeKey).toBe(scope);
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        visible: true,
        inputText: result.current.input.inputText,
        queryResult: result.current.input.queryResult,
        loading: result.current.input.loading,
        validationEnabled: result.current.input.enabled,
        isConnectWalletAction: false,
      }),
    ).toBe(false);
    await act(async () => jest.advanceTimersByTimeAsync(1500));
    expect(mockQueryAddress).toHaveBeenCalledTimes(1);
  });

  it('waits for the retry to resolve the sender before checking an external recipient', async () => {
    jest.useFakeTimers();
    mockGetDeriveType
      .mockRejectedValueOnce(new Error('derive lookup failed'))
      .mockResolvedValue('default');
    const { result } = renderRecipientValidation();
    act(() => result.current.input.onInputChange('external-recipient'));
    await act(async () => jest.advanceTimersByTimeAsync(499));
    expect(mockQueryAddress).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTimeAsync(1));
    expect(result.current.validation.isAddressInfoReady).toBe(true);
    await act(async () => jest.advanceTimersByTimeAsync(300));
    expect(mockQueryAddress).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'target' }),
    );
    expect(result.current.validation.isAddressInfoReady).toBe(true);
    expect(mockQueryAddress).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh pending context after switching away from a failed source', async () => {
    jest.useFakeTimers();
    mockGetDeriveType.mockRejectedValue(new Error('derive lookup failed'));
    const { result, rerender } = renderAddressContexts();
    await act(async () => jest.advanceTimersByTimeAsync(500));
    expect(result.current.validation.isRecipientValidationReady).toBe(true);
    const scope = result.current.validation.validationScopeKey;

    let completeLookup: ((value: IAccountDeriveTypes) => void) | undefined;
    mockGetDeriveType.mockImplementation(
      () =>
        new Promise((resolve) => {
          completeLookup = resolve;
        }),
    );
    mockAccounts[0] = buildActiveAccount('new-source');
    rerender();
    expect(result.current.validation.validationScopeKey).not.toBe(scope);
    expect(result.current.validation.isRecipientValidationReady).toBe(false);
    await act(async () => completeLookup?.('default'));
    expect(result.current.validation.isRecipientValidationReady).toBe(true);
    expect(result.current.validation.isAddressInfoReady).toBe(true);
  });

  it('ignores a failed lookup from a source that has already been replaced', async () => {
    jest.useFakeTimers();
    let rejectOldLookup: ((reason: Error) => void) | undefined;
    mockGetDeriveType.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOldLookup = reject;
        }),
    );
    const { result, rerender } = renderAddressContexts();
    mockAccounts[0] = buildActiveAccount('new-source');
    rerender();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(result.current.validation.isAddressInfoReady).toBe(true);
    const scope = result.current.validation.validationScopeKey;

    mockGetDeriveType.mockRejectedValue(new Error('old lookup failed'));
    await act(async () => {
      rejectOldLookup?.(new Error('old lookup failed'));
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(result.current.validation.validationScopeKey).toBe(scope);
    expect(result.current.validation.isAddressInfoReady).toBe(true);
    expect(result.current.validation.isRecipientValidationReady).toBe(true);
  });
});
