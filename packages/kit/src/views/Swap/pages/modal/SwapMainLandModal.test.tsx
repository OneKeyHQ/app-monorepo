/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import SwapMainLandModal from './SwapMainLandModal';

const mockSelect = jest.fn<Promise<void>, [unknown]>();
const mockInvalidateTokenCache = jest.fn();
const mockInvalidateSupportAccounts = jest.fn();
const mockGetUrlAccount = jest.fn<
  Promise<{ address: string } | undefined>,
  []
>();
let mockAccount = {
  ready: true,
  account: {
    id: accountUtils.URL_ACCOUNT_ID,
    addressDetail: { address: 'address-a' },
  },
  network: { id: 'btc--0' },
};
let mockAccountUpdate: (() => void) | undefined;
let mockUrlEntry = true;

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: mockUrlEntry
      ? { importUrlAccount: { address: 'address-a', networkId: 'btc--0' } }
      : {},
  }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children);
  return {
    EPageType: { modal: 'modal' },
    Page: Object.assign(Box, { Header: Box }),
    SizableText: Box,
    Spinner: () => createElement('div', null, 'loading'),
    Stack: ({
      children,
      display,
    }: {
      children?: ReactNode;
      display?: 'none' | 'flex';
    }) =>
      createElement(
        'div',
        { 'data-testid': 'swap-content', style: { display } },
        children,
      ),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getUrlDBAccountSafe: () => mockGetUrlAccount() },
  },
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockAccount }),
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: { updateSelectedAccountForSingletonAccount: mockSelect },
    }),
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { swapUrlAccount: 'swapUrlAccount' },
  useSettingsAtom: () => [{ swapToAnotherAccountSwitchOn: false }, jest.fn()],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { AccountUpdate: 'AccountUpdate' },
  appEventBus: {
    on: (_name: string, callback: () => void) => {
      mockAccountUpdate = callback;
    },
    off: () => {
      mockAccountUpdate = undefined;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { swap: { enterSwap: { enterSwap: jest.fn() } } },
}));
jest.mock('../../utils/swapTokenSelectorCacheUtils', () => ({
  invalidateUrlAccountTokenSelectorCache: () => {
    mockInvalidateTokenCache();
  },
}));
jest.mock('../../hooks/useSwapTokens', () => ({
  invalidateSwapSupportAllAccounts: () => {
    mockInvalidateSupportAccounts();
  },
}));
jest.mock('../components/SwapMainLand', () => ({
  __esModule: true,
  default: ({ reviewContextKey }: { reviewContextKey?: string }) => (
    <div data-testid="swap-main" data-review-context={reviewContextKey}>
      swap-ready
      <input aria-label="amount" />
    </div>
  ),
}));

describe('unimported account swap entry', () => {
  beforeEach(() => {
    mockUrlEntry = true;
    mockSelect.mockReset().mockResolvedValue();
    mockInvalidateTokenCache.mockReset();
    mockInvalidateSupportAccounts.mockReset();
    mockGetUrlAccount.mockReset().mockResolvedValue({ address: 'address-a' });
    mockAccount = {
      ready: true,
      account: {
        id: accountUtils.URL_ACCOUNT_ID,
        addressDetail: { address: 'address-a' },
      },
      network: { id: 'btc--0' },
    };
  });

  it('leaves the ordinary swap account untouched', async () => {
    mockUrlEntry = false;
    render(<SwapMainLandModal />);
    await screen.findByText('swap-ready');
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockGetUrlAccount).not.toHaveBeenCalled();
    expect(mockInvalidateTokenCache).not.toHaveBeenCalled();
    expect(mockInvalidateSupportAccounts).not.toHaveBeenCalled();
  });

  it('waits for the URL account and blocks the swap while that account is being replaced', async () => {
    render(<SwapMainLandModal />);
    await screen.findByText('swap-ready');
    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        othersWalletAccountId: accountUtils.URL_ACCOUNT_ID,
        networkId: 'btc--0',
      }),
    );
    let finish: ((account: { address: string }) => void) | undefined;
    mockGetUrlAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => mockAccountUpdate?.());
    expect(mockInvalidateTokenCache).toHaveBeenCalledTimes(2);
    expect(mockInvalidateSupportAccounts).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('swap-content').style.display).toBe('none');
    expect(screen.getByText('swap-ready')).toBeTruthy();
    expect(screen.getByText('loading')).toBeTruthy();
    await act(async () => finish?.({ address: 'address-b' }));
    await waitFor(() => expect(screen.queryByText('swap-ready')).toBeNull());
    expect(screen.queryByText('loading')).toBeNull();
  });

  it('ignores an older verification after the URL account is replaced', async () => {
    render(<SwapMainLandModal />);
    await screen.findByText('swap-ready');
    let finishOld: ((account: { address: string }) => void) | undefined;
    let finishNew: ((account: { address: string }) => void) | undefined;
    mockGetUrlAccount
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          }),
      );
    act(() => {
      mockAccountUpdate?.();
      mockAccountUpdate?.();
    });
    await act(async () => finishNew?.({ address: 'address-b' }));
    await act(async () => finishOld?.({ address: 'address-a' }));
    expect(screen.queryByText('swap-ready')).toBeNull();
    expect(screen.queryByText('loading')).toBeNull();
  });

  it('preserves an amount when an account update verifies the same URL address', async () => {
    render(<SwapMainLandModal />);
    await screen.findByText('swap-ready');
    const amount = screen.getByLabelText('amount');
    fireEvent.change(amount, { target: { value: '1.25' } });
    let finish: ((account: { address: string }) => void) | undefined;
    mockGetUrlAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => mockAccountUpdate?.());
    expect(screen.getByTestId('swap-content').style.display).toBe('none');
    await act(async () => finish?.({ address: 'address-a' }));
    expect(screen.getByTestId('swap-content').style.display).toBe('flex');
    expect(screen.getByLabelText('amount')).toBe(amount);
    expect((amount as HTMLInputElement).value).toBe('1.25');
  });

  it('does not invalidate the review context of a different selected account', async () => {
    const { rerender } = render(<SwapMainLandModal />);
    await screen.findByText('swap-ready');
    mockAccount = {
      ...mockAccount,
      account: {
        id: 'watching--other-account',
        addressDetail: { address: 'other-address' },
      },
    };
    rerender(<SwapMainLandModal />);
    const reviewContext = screen
      .getByTestId('swap-main')
      .getAttribute('data-review-context');
    mockGetUrlAccount.mockImplementationOnce(() => new Promise(() => {}));

    act(() => mockAccountUpdate?.());

    expect(screen.getByTestId('swap-content').style.display).toBe('flex');
    expect(
      screen.getByTestId('swap-main').getAttribute('data-review-context'),
    ).toBe(reviewContext);
  });
});
