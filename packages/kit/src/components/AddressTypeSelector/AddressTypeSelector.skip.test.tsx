/** @jest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';

import type { IPopoverProps } from '@onekeyhq/components';

import AddressTypeSelector from './AddressTypeSelector';

const mockGetDeriveTypesCollapseState = jest.fn<Promise<unknown>, unknown[]>();
let mockPopoverProps: IPopoverProps | undefined;

jest.mock('@onekeyhq/components', () => {
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
    usePopoverContext: () => ({ closePopover: jest.fn() }),
    Popover: (props: IPopoverProps) => {
      mockPopoverProps = props;
      return null;
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

jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _loader: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => ({ result: options?.initResult, run: jest.fn() }),
}));

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
  render(
    <AddressTypeSelector
      walletId="hd-1"
      networkId="btc--0"
      indexedAccountId="hd-1--0"
      whenCollapsed="skip"
      onSelect={onSelect}
    />,
  );
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
});
