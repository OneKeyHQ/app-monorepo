/** @jest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';

import type { IPopoverProps } from '@onekeyhq/components';

import AddressTypeSelector from './AddressTypeSelector';

const mockGetDeriveTypesCollapseState = jest.fn<Promise<unknown>, unknown[]>();
const mockFetchAccountTokens = jest.fn(async (_params: unknown) => ({}));
let mockResolveNetworkAccounts: (value: unknown) => void;
let mockPopoverProps: IPopoverProps | undefined;

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const OpenContext = React.createContext(false);
  const Stub = () => null;
  return {
    Button: Stub,
    Icon: Stub,
    IconButton: Stub,
    ListView: Stub,
    SizableText: Stub,
    Toast: { success: jest.fn(), error: jest.fn() },
    XStack: Stub,
    YStack: Stub,
    usePopoverContext: () => ({
      open: React.useContext(OpenContext),
      closePopover: jest.fn(),
    }),
    Popover: (props: IPopoverProps) => {
      const [open, setOpen] = React.useState(false);
      mockPopoverProps = {
        ...props,
        onOpenChange: (next) => {
          setOpen(next);
          props.onOpenChange?.(next);
        },
      };
      return (
        <OpenContext.Provider value={props.open ?? open}>
          {React.isValidElement(props.renderContent)
            ? props.renderContent
            : null}
        </OpenContext.Provider>
      );
    },
  };
});

const mockShowToastOfError = jest.fn<void, unknown[]>();
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    showToastOfError: (...args: unknown[]) => mockShowToastOfError(...args),
    isUserCancelStyleError: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      fetchAccountTokens: (params: unknown) => mockFetchAccountTokens(params),
      getDeriveTypesCollapseState: (...args: unknown[]) =>
        mockGetDeriveTypesCollapseState(...args),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn(async () => 'BIP86'),
    },
  },
}));

jest.mock('../../hooks/useAccountData', () => ({
  useAccountData: () => ({ network: undefined }),
}));

jest.mock('../../hooks/usePromiseResult', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (
      _loader: unknown,
      _deps: unknown,
      options?: { initResult?: unknown },
    ) => {
      const [result, setResult] = useState(options?.initResult);
      if (Array.isArray(options?.initResult)) {
        mockResolveNetworkAccounts = setResult;
      }
      return { result, run: jest.fn() };
    },
  };
});

jest.mock('../AccountSelector/AccountSelectorProvider', () => ({
  AccountSelectorProviderMirror: ({ children }: { children: unknown }) =>
    children,
}));

jest.mock('../AccountSelector/hooks/useAccountSelectorCreateAddress', () => ({
  useAccountSelectorCreateAddress: () => ({ createAddress: jest.fn() }),
}));

jest.mock('./AddressTypeSelectorItem', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./AddressTypeSelectorTrigger', () => ({
  __esModule: true,
  default: () => null,
}));

const DEFAULT_NETWORK_ACCOUNT = { deriveType: 'BIP86', account: { id: 'a1' } };

function renderSkipSelector(onSelect: jest.Mock) {
  const renderFor = (indexedAccountId: string) => (
    <AddressTypeSelector
      walletId="hd-1"
      networkId="btc--0"
      indexedAccountId={indexedAccountId}
      whenCollapsed="skip"
      onSelect={onSelect}
    />
  );
  const view = render(renderFor('hd-1--0'));
  return {
    ...view,
    switchAccount: (indexedAccountId: string) =>
      view.rerender(renderFor(indexedAccountId)),
  };
}

function deferCollapseState() {
  let resolve: (value: unknown) => void = () => {};
  mockGetDeriveTypesCollapseState.mockReturnValue(
    new Promise((promiseResolve) => {
      resolve = promiseResolve;
    }),
  );
  return (value: unknown) => act(async () => resolve(value));
}

// Narrow web layouts report one press on the trigger twice in a row.
async function pressTriggerTwice() {
  await act(async () => {
    mockPopoverProps?.onOpenChange?.(true);
    mockPopoverProps?.onOpenChange?.(true);
  });
}

describe('AddressTypeSelector whenCollapsed="skip"', () => {
  beforeEach(() => {
    mockGetDeriveTypesCollapseState.mockReset();
    mockShowToastOfError.mockReset();
    mockPopoverProps = undefined;
  });

  it('runs a collapsed entry once per press', async () => {
    mockGetDeriveTypesCollapseState.mockResolvedValue({
      collapsed: true,
      defaultNetworkAccount: DEFAULT_NETWORK_ACCOUNT,
    });
    const onSelect = jest.fn();
    renderSkipSelector(onSelect);

    await pressTriggerTwice();

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenCalledWith(DEFAULT_NETWORK_ACCOUNT);
    expect(mockGetDeriveTypesCollapseState).toHaveBeenCalledTimes(1);
    expect(mockPopoverProps?.open).toBe(false);
  });

  it('opens the list when the account is not collapsed', async () => {
    mockGetDeriveTypesCollapseState.mockResolvedValue({ collapsed: false });
    const onSelect = jest.fn();
    renderSkipSelector(onSelect);

    await pressTriggerTwice();

    await waitFor(() => expect(mockPopoverProps?.open).toBe(true));
    expect(onSelect).not.toHaveBeenCalled();
    expect(mockGetDeriveTypesCollapseState).toHaveBeenCalledTimes(1);
  });

  it('opens the list when the background call fails', async () => {
    mockGetDeriveTypesCollapseState.mockRejectedValue(new Error('timeout'));
    const onSelect = jest.fn();
    renderSkipSelector(onSelect);

    await pressTriggerTwice();

    await waitFor(() => expect(mockPopoverProps?.open).toBe(true));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reports a failing entry action instead of opening the list', async () => {
    mockGetDeriveTypesCollapseState.mockResolvedValue({
      collapsed: true,
      defaultNetworkAccount: DEFAULT_NETWORK_ACCOUNT,
    });
    const failure = new Error('widget url failed');
    const onSelect = jest.fn(async () => {
      throw failure;
    });
    renderSkipSelector(onSelect);

    await pressTriggerTwice();

    await waitFor(() =>
      expect(mockShowToastOfError).toHaveBeenCalledWith(failure),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(mockPopoverProps?.open).toBe(false);
  });

  it('answers the next press after the previous one finished', async () => {
    mockGetDeriveTypesCollapseState.mockResolvedValue({
      collapsed: true,
      defaultNetworkAccount: DEFAULT_NETWORK_ACCOUNT,
    });
    const onSelect = jest.fn();
    renderSkipSelector(onSelect);

    await pressTriggerTwice();
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    await pressTriggerTwice();

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
  });

  it('drops a lookup answered after the account changed', async () => {
    const answer = deferCollapseState();
    const onSelect = jest.fn();
    const { switchAccount } = renderSkipSelector(onSelect);

    await pressTriggerTwice();
    switchAccount('hd-1--1');
    await answer({
      collapsed: true,
      defaultNetworkAccount: DEFAULT_NETWORK_ACCOUNT,
    });

    expect(onSelect).not.toHaveBeenCalled();
    expect(mockPopoverProps?.open).toBe(false);
  });

  it('drops a lookup answered after the selector unmounted', async () => {
    const answer = deferCollapseState();
    const onSelect = jest.fn();
    const { unmount } = renderSkipSelector(onSelect);

    await pressTriggerTwice();
    unmount();
    await answer({
      collapsed: true,
      defaultNetworkAccount: DEFAULT_NETWORK_ACCOUNT,
    });

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('AddressTypeSelector refreshOnOpen', () => {
  it.each([false, true])(
    'fetches balances only while open (open before accounts resolve: %s)',
    async (openBeforeAccountsResolve) => {
      mockFetchAccountTokens.mockClear();
      render(
        <AddressTypeSelector
          walletId="hd-1"
          networkId="btc--0"
          indexedAccountId="hd-1--0"
          refreshOnOpen
        />,
      );
      const open = () =>
        act(async () => mockPopoverProps?.onOpenChange?.(true));
      if (openBeforeAccountsResolve) {
        await open();
      }
      expect(mockFetchAccountTokens).not.toHaveBeenCalled();

      act(() => {
        mockResolveNetworkAccounts([
          { account: { id: 'a1' }, deriveType: 'BIP86' },
        ]);
      });
      if (!openBeforeAccountsResolve) {
        expect(mockFetchAccountTokens).not.toHaveBeenCalled();
        await open();
      }
      await waitFor(() =>
        expect(mockFetchAccountTokens).toHaveBeenCalledTimes(1),
      );
      expect(mockFetchAccountTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'a1',
          flag: 'address-type-selector',
        }),
      );
    },
  );
});
