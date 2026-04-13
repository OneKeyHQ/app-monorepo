/** @jest-environment jsdom */

import type { SetStateAction } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IAddressQueryResult } from '@onekeyhq/kit/src/components/AddressInput';
import type { IQueryCheckAddressArgs } from '@onekeyhq/shared/types/address';

import {
  shouldBlockSwapActionForIncognitoRecipientInput,
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

  it('revalidates the current input when the validation scope changes', async () => {
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
      networkId: 'evm--10',
      accountId: 'account-2',
      address: undefined,
      swapToAnotherAccountSwitchOn: false,
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
          networkId: 'evm--10',
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
        enabled: true,
        inputText: '0xrecipient',
        loading: false,
        queryResult: {},
      }),
    ).toBe(true);
  });

  it('allows review after the recipient input is validated', () => {
    expect(
      shouldBlockSwapActionForIncognitoRecipientInput({
        enabled: true,
        inputText: '0xrecipient',
        loading: false,
        queryResult: {
          validStatus: 'valid',
        },
      }),
    ).toBe(false);
  });
});
