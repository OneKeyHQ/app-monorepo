/** @jest-environment jsdom */

import type { SetStateAction } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import type { IQueryCheckAddressArgs } from '@onekeyhq/shared/types/address';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  shouldBlockSwapActionForIncognitoRecipientInput,
  shouldEnableSwapIncognitoRecipientValidation,
  shouldShowSwapIncognitoRecipientInput,
  useSwapIncognitoRecipientInput,
} from './useSwapIncognitoRecipientInput';

type ISettingsState = {
  swapToAnotherAccountSwitchOn: boolean;
};

type ISwapToAddressState = {
  accountInfo?: unknown;
  address?: string;
  networkId?: string;
};

type IHookProps = {
  accountId?: string;
  address?: string;
  clearRecipientAddressOnHide?: boolean;
  networkId?: string;
  swapToAnotherAccountSwitchOn: boolean;
  validationEnabled: boolean;
  visible: boolean;
};

const mockQueryAddressWithFallback: jest.MockedFunction<
  (params: IQueryCheckAddressArgs) => Promise<IAddressQueryResult>
> = jest.fn();
const mockSetSettings = jest.fn();
const mockSetSwapToAddress = jest.fn();

let mockSettingsState: ISettingsState = {
  swapToAnotherAccountSwitchOn: false,
};
let mockSwapToAddressState: ISwapToAddressState = {};

function applyStateUpdater<T>(state: T, updater: SetStateAction<T>): T {
  return typeof updater === 'function'
    ? (updater as (prevState: T) => T)(state)
    : updater;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

async function flushDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderUseSwapIncognitoRecipientInput(initialProps: IHookProps) {
  return renderHook(useSwapIncognitoRecipientInput, {
    initialProps,
  });
}

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/AddressInput/utils', () => ({
  getAddressQueryResolvedAddress: (result: {
    input?: string;
    resolveAddress?: string;
    validAddress?: string;
  }) => result.resolveAddress ?? result.validAddress ?? result.input?.trim(),
  getAddressValidateTranslationId: () => undefined,
  queryAddressWithFallback: (params: IQueryCheckAddressArgs) =>
    mockQueryAddressWithFallback(params),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [mockSettingsState, mockSetSettings],
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapToAnotherAccountAddressAtom: () => [
    mockSwapToAddressState,
    mockSetSwapToAddress,
  ],
}));

describe('useSwapIncognitoRecipientInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockSettingsState = {
      swapToAnotherAccountSwitchOn: false,
    };
    mockSwapToAddressState = {};

    mockSetSettings.mockImplementation(
      (updater: SetStateAction<ISettingsState>) => {
        mockSettingsState = applyStateUpdater(mockSettingsState, updater);
      },
    );
    mockSetSwapToAddress.mockImplementation(
      (updater: SetStateAction<ISwapToAddressState>) => {
        mockSwapToAddressState = applyStateUpdater(
          mockSwapToAddressState,
          updater,
        );
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ignores late validation results after the incognito input is hidden', async () => {
    const pendingValidation = createDeferred<IAddressQueryResult>();
    mockQueryAddressWithFallback.mockReturnValueOnce(pendingValidation.promise);

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: true,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    expect(mockQueryAddressWithFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        address: '0xrecipient',
        networkId: 'evm--1',
      }),
    );

    rerender({
      visible: false,
      clearRecipientAddressOnHide: true,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    await act(async () => {
      pendingValidation.resolve({
        input: '0xrecipient',
        resolveAddress: '0xresolved-recipient',
        validStatus: 'valid',
      });
      await pendingValidation.promise;
    });

    await flushAsync();

    expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(false);
    expect(mockSwapToAddressState.address).toBeUndefined();
    expect(result.current.inputText).toBe('');
  });

  it('clears the current input when the recipient network changes', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: '0xrecipient',
      resolveAddress: '0xresolved-1',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockSwapToAddressState.address).toBe('0xresolved-1');
    });

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'aptos--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    expect(result.current.inputText).toBe('');
    expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(false);
    expect(mockSwapToAddressState.address).toBeUndefined();

    await flushDebounce();
    expect(mockQueryAddressWithFallback).toHaveBeenCalledTimes(1);
  });

  it('preserves typed text until the recipient validation context is ready', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: '0xrecipient',
      resolveAddress: '0xresolved-recipient',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: undefined,
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: false,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    expect(result.current.enabled).toBe(false);
    expect(result.current.inputText).toBe('0xrecipient');
    expect(mockQueryAddressWithFallback).not.toHaveBeenCalled();
    expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(false);
    expect(mockSwapToAddressState.address).toBeUndefined();

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    expect(result.current.inputText).toBe('0xrecipient');

    await flushDebounce();

    await waitFor(() => {
      expect(mockQueryAddressWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'account-1',
          address: '0xrecipient',
          networkId: 'evm--1',
        }),
      );
      expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockSwapToAddressState.address).toBe('0xresolved-recipient');
    });
  });

  it('preserves raw text typed while validation is paused after another network was enabled', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: 'sol-recipient',
      resolveAddress: 'sol-resolved-recipient',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: false,
    });

    act(() => {
      result.current.onInputChange('sol-recipient');
    });

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'sol--101',
      accountId: 'account-sol',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    expect(result.current.inputText).toBe('sol-recipient');

    await flushDebounce();

    await waitFor(() => {
      expect(mockQueryAddressWithFallback).toHaveBeenCalledTimes(1);
      expect(mockQueryAddressWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'account-sol',
          address: 'sol-recipient',
          networkId: 'sol--101',
        }),
      );
      expect(mockSwapToAddressState.address).toBe('sol-resolved-recipient');
    });
  });

  it('waits for the resolved target account before validating preserved text', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: '0xrecipient',
      resolveAddress: '0xresolved-recipient',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--10',
      accountId: 'stale-account',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: false,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    expect(result.current.inputText).toBe('0xrecipient');
    expect(mockQueryAddressWithFallback).not.toHaveBeenCalled();

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--10',
      accountId: 'resolved-account',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockQueryAddressWithFallback).toHaveBeenCalledTimes(1);
      expect(mockQueryAddressWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'resolved-account',
          address: '0xrecipient',
          networkId: 'evm--10',
        }),
      );
    });
  });

  it('preserves edited text when switching networks before it is revalidated', async () => {
    mockQueryAddressWithFallback
      .mockResolvedValueOnce({
        input: '0xrecipient',
        resolveAddress: '0xresolved-recipient',
        validStatus: 'valid',
      })
      .mockResolvedValueOnce({
        input: 'sol-recipient',
        resolveAddress: 'sol-resolved-recipient',
        validStatus: 'valid',
      });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockSwapToAddressState.address).toBe('0xresolved-recipient');
    });

    act(() => {
      result.current.onInputChange('sol-recipient');
    });

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'sol--101',
      accountId: 'account-sol',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    expect(result.current.inputText).toBe('sol-recipient');

    await flushDebounce();

    await waitFor(() => {
      expect(mockQueryAddressWithFallback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          accountId: 'account-sol',
          address: 'sol-recipient',
          networkId: 'sol--101',
        }),
      );
      expect(mockSwapToAddressState.address).toBe('sol-resolved-recipient');
    });
  });

  it('clears input after a validated network changes while validation is paused', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: '0xrecipient',
      resolveAddress: '0xresolved-recipient',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockSwapToAddressState.address).toBe('0xresolved-recipient');
    });

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'sol--101',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: false,
    });

    expect(result.current.inputText).toBe('0xrecipient');
    expect(mockSwapToAddressState.address).toBeUndefined();

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'sol--101',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    expect(result.current.inputText).toBe('');
    expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(false);

    await flushDebounce();
    expect(mockQueryAddressWithFallback).toHaveBeenCalledTimes(1);
  });

  it('revalidates the current input when only the validation account changes', async () => {
    mockQueryAddressWithFallback
      .mockResolvedValueOnce({
        input: '0xrecipient',
        resolveAddress: '0xresolved-1',
        validStatus: 'valid',
      })
      .mockResolvedValueOnce({
        input: '0xrecipient',
        resolveAddress: '0xresolved-2',
        validStatus: 'valid',
      });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockSwapToAddressState.address).toBe('0xresolved-1');
    });

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-2',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    expect(result.current.inputText).toBe('0xrecipient');
    expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(false);
    expect(mockSwapToAddressState.address).toBeUndefined();

    await flushDebounce();

    await waitFor(() => {
      expect(mockQueryAddressWithFallback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          accountId: 'account-2',
          address: '0xrecipient',
          networkId: 'evm--1',
        }),
      );
      expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockSwapToAddressState.address).toBe('0xresolved-2');
    });
  });

  it('clears the confirmed recipient when the input is hidden without a fallback recipient UI', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: '0xrecipient',
      resolveAddress: '0xresolved-recipient',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: true,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockSwapToAddressState.address).toBe('0xresolved-recipient');
    });

    rerender({
      visible: false,
      clearRecipientAddressOnHide: true,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: mockSwapToAddressState.address,
      swapToAnotherAccountSwitchOn: true,
      validationEnabled: true,
    });

    await flushAsync();

    expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(false);
    expect(mockSwapToAddressState.address).toBeUndefined();
    expect(result.current.inputText).toBe('');
  });

  it('preserves the confirmed recipient when the input is hidden but another recipient UI remains available', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: '0xrecipient',
      resolveAddress: '0xresolved-recipient',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    act(() => {
      result.current.onInputChange('0xrecipient');
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockSwapToAddressState.address).toBe('0xresolved-recipient');
    });

    rerender({
      visible: false,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: mockSwapToAddressState.address,
      swapToAnotherAccountSwitchOn: true,
      validationEnabled: true,
    });

    await flushAsync();

    expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
    expect(mockSwapToAddressState.address).toBe('0xresolved-recipient');
    expect(result.current.inputText).toBe('');
  });

  it('clears the input when the recipient is reset externally after the synced address is revalidated', async () => {
    mockQueryAddressWithFallback.mockResolvedValueOnce({
      input: '0xresolved-recipient',
      resolveAddress: '0xresolved-recipient',
      validStatus: 'valid',
    });

    const { result, rerender } = renderUseSwapIncognitoRecipientInput({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: '0xresolved-recipient',
      swapToAnotherAccountSwitchOn: true,
      validationEnabled: true,
    });

    await flushDebounce();

    await waitFor(() => {
      expect(mockSettingsState.swapToAnotherAccountSwitchOn).toBe(true);
      expect(mockSwapToAddressState.address).toBe('0xresolved-recipient');
      expect(result.current.inputText).toBe('0xresolved-recipient');
    });

    rerender({
      visible: true,
      clearRecipientAddressOnHide: false,
      networkId: 'evm--1',
      accountId: 'account-1',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
      validationEnabled: true,
    });

    await waitFor(() => {
      expect(result.current.inputText).toBe('');
    });
  });
});

describe('shouldBlockSwapActionForIncognitoRecipientInput', () => {
  it('blocks review while the recipient input is still unresolved', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        inputText: '0xrecipient',
        isConnectWalletAction: false,
        loading: false,
        queryResult: {},
        validationEnabled: true,
        visible: true,
      }),
    ).toBe(true);
  });

  it('allows review after the recipient input is validated', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        inputText: '0xrecipient',
        isConnectWalletAction: false,
        loading: false,
        queryResult: {
          validStatus: 'valid',
        },
        validationEnabled: true,
        visible: true,
      }),
    ).toBe(false);
  });

  it('blocks review while a visible recipient is waiting for validation readiness', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        inputText: '0xrecipient',
        isConnectWalletAction: false,
        loading: false,
        queryResult: {
          validStatus: 'valid',
        },
        validationEnabled: false,
        visible: true,
      }),
    ).toBe(true);
  });

  it('blocks review while a validated recipient is being rechecked', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        inputText: '0xrecipient',
        isConnectWalletAction: false,
        loading: true,
        queryResult: {
          validStatus: 'valid',
        },
        validationEnabled: true,
        visible: true,
      }),
    ).toBe(true);
  });

  it('does not block review after the recipient input is hidden', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        inputText: '0xrecipient',
        isConnectWalletAction: false,
        loading: false,
        queryResult: {},
        validationEnabled: false,
        visible: false,
      }),
    ).toBe(false);
  });

  it('does not block review for an empty recipient input', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        inputText: '   ',
        isConnectWalletAction: false,
        loading: false,
        queryResult: {},
        validationEnabled: false,
        visible: true,
      }),
    ).toBe(false);
  });

  it('keeps Connect Wallet available while recipient validation is pending', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        inputText: '0xrecipient',
        isConnectWalletAction: true,
        loading: false,
        queryResult: {},
        validationEnabled: false,
        visible: true,
      }),
    ).toBe(false);
  });
});

describe('shouldEnableSwapIncognitoRecipientValidation', () => {
  const readyParams = {
    hasFromToken: true,
    hasToToken: true,
    isAddressInfoReady: true,
    networkId: 'evm--1',
    providerSupportsRecipient: true,
    visible: true,
  };

  it('waits for the target address context to resolve', () => {
    expect(
      shouldEnableSwapIncognitoRecipientValidation({
        ...readyParams,
        isAddressInfoReady: false,
      }),
    ).toBe(false);
  });

  it('enables validation after every recipient dependency is ready', () => {
    expect(shouldEnableSwapIncognitoRecipientValidation(readyParams)).toBe(
      true,
    );
  });
});

describe('shouldShowSwapIncognitoRecipientInput', () => {
  it('keeps the input visible before token selection while support is available', () => {
    expect(
      shouldShowSwapIncognitoRecipientInput({
        incognitoMode: true,
        providerSupportsRecipient: true,
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(true);
  });

  it('hides the input when the selected provider cannot use the address', () => {
    expect(
      shouldShowSwapIncognitoRecipientInput({
        incognitoMode: true,
        providerSupportsRecipient: false,
        swapType: ESwapTabSwitchType.SWAP,
      }),
    ).toBe(false);
  });
});
