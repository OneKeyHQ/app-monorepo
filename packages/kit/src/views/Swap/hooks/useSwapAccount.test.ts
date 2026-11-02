/** @jest-environment jsdom */

import type { SetStateAction } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
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
  [{ networkId: string }]
>();
let mockSettings = { swapToAnotherAccountSwitchOn: false };
type IRecipientState = {
  address?: string;
  networkId?: string;
  accountInfo?: IAccountSelectorActiveAccountInfo;
};
let mockRecipient: IRecipientState = {};
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
