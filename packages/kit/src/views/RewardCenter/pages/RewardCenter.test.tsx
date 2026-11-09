/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { RewardCenterTestIDs } from '../testIDs';

import RewardCenter, { TronRewardCenterContent } from './RewardCenter';

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockWaitForAutoSelectUnlock = jest.fn(async () => undefined);
const mockUpdateSelectedAccountFocusedWallet = jest.fn(
  async (_params: unknown) => undefined,
);
const mockGetSelectedAccount = jest.fn((_params: unknown) => ({}));
const mockReloadActiveAccountInfo = jest.fn(
  async (_params: unknown) => undefined,
);
const mockErrorLog = jest.fn((_message: string) => undefined);
const mockIsOthersAccount = jest.fn((_params: unknown) => false);

const mockNetwork = { id: 'tron--0x2b6653dc' };
const mockAccount = {
  id: 'hd-1--account-1',
  address: 'test-address',
  name: 'Account 1',
};
let mockActiveAccount: {
  network?: typeof mockNetwork;
  account?: typeof mockAccount;
} = {};
const mockClaim = jest.fn<
  Promise<{ success: boolean; resMsg?: string } | undefined>,
  []
>();
let mockRedeemCode = '';
const mockRedeem = jest.fn<
  Promise<{ success: boolean } | undefined>,
  [unknown]
>();
const mockInventory = {
  remaining: 1,
  totalReceivedLimit: 500,
  monthIPRemain: 2,
  monthRemain: 2,
  isReceived: false,
};
const mockDefer = {
  promise: Promise.resolve(),
  resolve: jest.fn(),
  reset: jest.fn(),
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      accountId: 'hd-1--account-1',
      networkId: 'tron--0x2b6653dc',
      walletId: 'hd-1',
      showAccountSelector: true,
    },
  }),
}));

// One factory serves both the bare package import and the
// '@onekeyhq/components/src/hooks/useForm' subpath import: the repo-wide
// moduleNameMapper collapses every '@onekeyhq/components*' specifier into the
// same mocked module.
jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  const Null = () => null;
  return {
    Alert: Null,
    Button: ({
      testID,
      disabled,
      onPress,
      children,
    }: {
      testID?: string;
      disabled?: boolean;
      onPress?: () => void;
      children?: ReactNode;
    }) => (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    Divider: Null,
    Form: Object.assign(Passthrough, { Field: Passthrough }),
    Input: Null,
    NavCloseButton: Null,
    Page: Object.assign(Passthrough, { Header: Null, Body: Passthrough }),
    SizableText: Null,
    Skeleton: Object.assign(Null, { BodyLg: Null }),
    Stack: Passthrough,
    Toast: { error: jest.fn(), success: jest.fn() },
    XStack: Passthrough,
    YStack: Passthrough,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: () => mockDefer,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    useForm: () => ({
      resetField: jest.fn(),
      getValues: () => mockRedeemCode,
      reset: () => {
        mockRedeemCode = '';
      },
      formState: { isSubmitting: false, isValid: Boolean(mockRedeemCode) },
    }),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    reward: {
      tronReward: { claimResource: jest.fn(), redeemResource: jest.fn() },
    },
    app: {
      error: {
        log: (message: string) => mockErrorLog(message),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    buildIndexedAccountId: () => mockAccount.id,
    isWatchingAccount: () => false,
    isOthersAccount: (params: unknown) => mockIsOthersAccount(params),
    isQrAccount: () => false,
    getWalletIdFromAccountId: () => 'hd-1',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isTronNetworkByNetworkId: (id?: string) => id === mockNetwork.id,
    isAllNetwork: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/chainResourceUtils', () => ({
  __esModule: true,
  default: {
    buildTronClaimResourceParams: () => ({ timestamp: 1, signed: 'fixture' }),
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: { getNativeToken: async () => undefined },
    serviceAccountProfile: {
      sendProxyRequestWithTrxRes: async ({
        body,
      }: {
        body: { url: string };
      }) => {
        if (body.url === '/api/tronRent/isReceived') return mockInventory;
        if (body.url === '/api/account')
          return { code: 0, data: { isActived: true } };
        if (body.url === '/api/v1/coupon/redeem') return mockRedeem(body);
        if (body.url === '/api/tronRent/addFreeTronRentRecord')
          return mockClaim();
        throw new OneKeyLocalError('Unexpected reward request');
      },
    },
    serviceAccount: {
      getAccountsByIndexedAccounts: async () => ({ accounts: [] }),
      getAccount: async () => ({ id: 'hd-1--account-1' }),
      getWallet: async () => ({ id: 'hd-1' }),
      getIndexedAccountByAccount: async () => ({ id: 'hd-1--0' }),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: async () => 'default',
      getNetwork: async () => ({ id: 'tron--0x2b6653dc' }),
    },
  },
}));

jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children ?? null,
  AccountSelectorTriggerRewardCenter: () => null,
}));

jest.mock(
  '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => ({
      createAddress: jest.fn(),
    }),
  }),
);

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pop: jest.fn(),
    pushModal: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => {
  // The sync effect lists `actions` in its deps; the real hook returns a
  // stable ref, so the mock must too or the effect re-runs on every render.
  const stableActions = {
    current: {
      confirmAccountSelect: async (params: unknown) =>
        mockConfirmAccountSelect(params),
      waitForAutoSelectUnlock: async () => mockWaitForAutoSelectUnlock(),
      updateSelectedAccountFocusedWallet: async (params: unknown) =>
        mockUpdateSelectedAccountFocusedWallet(params),
      getSelectedAccount: (params: unknown) => mockGetSelectedAccount(params),
      reloadActiveAccountInfo: async (params: unknown) =>
        mockReloadActiveAccountInfo(params),
    },
  };
  return {
    useAccountSelectorActions: () => stableActions,
  };
});

async function renderAndFlushSync() {
  render(<RewardCenter />);
  // The selector sync effect chains several awaits; drain the microtask queue
  // until the whole chain settles before asserting.
  await act(async () => {
    for (let i = 0; i < 20; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
}

describe('RewardCenter account selector sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirmAccountSelect.mockImplementation(async () => true);
    mockIsOthersAccount.mockImplementation(() => false);
    mockGetSelectedAccount.mockImplementation(() => ({}));
  });

  it('aborts indexed-account initialization when selection is rejected', async () => {
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdateSelectedAccountFocusedWallet).not.toHaveBeenCalled();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('aborts others-account initialization when selection is rejected', async () => {
    mockIsOthersAccount.mockImplementation(() => true);
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdateSelectedAccountFocusedWallet).not.toHaveBeenCalled();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('aborts initialization when selection returns false', async () => {
    mockConfirmAccountSelect.mockResolvedValue(false);

    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdateSelectedAccountFocusedWallet).not.toHaveBeenCalled();
    expect(mockReloadActiveAccountInfo).not.toHaveBeenCalled();
  });

  it('runs the full init sequence without logging when the selection is persisted', async () => {
    await renderAndFlushSync();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockErrorLog).not.toHaveBeenCalled();
    expect(mockUpdateSelectedAccountFocusedWallet).toHaveBeenCalledTimes(1);
    expect(mockReloadActiveAccountInfo).toHaveBeenCalledTimes(1);
  });
});

describe('inline TRON energy claim', () => {
  beforeEach(() => {
    mockActiveAccount = { account: mockAccount, network: mockNetwork };
    mockClaim.mockReset();
    mockRedeem.mockReset();
    mockRedeemCode = '';
  });
  afterEach(() => {
    mockActiveAccount = {};
  });

  function inlineCenter(onClose?: () => void) {
    return (
      <TronRewardCenterContent
        params={{ accountId: '', networkId: mockNetwork.id, onClose }}
        renderInline={({ claimed, validUntil, claimDetails }) => (
          <>
            <span>{claimed ? 'claimed' : 'unclaimed'}</span>
            {validUntil ? <span>valid</span> : null}
            {claimDetails.claimButton}
            {claimDetails.redeemButton}
          </>
        )}
      />
    );
  }

  it('keeps the final claimed unit visible and disables repeat claims', async () => {
    mockClaim.mockResolvedValue({ success: true });
    render(inlineCenter());
    const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
    await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
      timeout: 3000,
    });
    fireEvent.click(claim);
    expect(await screen.findByText('claimed')).toBeTruthy();
    expect(screen.getByText('valid')).toBeTruthy();
    expect(claim).toHaveProperty('disabled', true);
    fireEvent.click(claim);
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('can redeem a code for the selected account after the last free unit is claimed', async () => {
    mockClaim.mockResolvedValue({ success: true });
    mockRedeem.mockResolvedValue({ success: true });
    const onClose = jest.fn();
    const view = render(inlineCenter(onClose));
    const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
    const redeem = screen.getByTestId(RewardCenterTestIDs.redeemBtn);
    expect(redeem).toHaveProperty('disabled', true);
    await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
      timeout: 3000,
    });
    fireEvent.click(claim);
    expect(await screen.findByText('claimed')).toBeTruthy();
    expect(claim).toHaveProperty('disabled', true);

    mockRedeemCode = 'test-coupon';
    view.rerender(inlineCenter(onClose));
    expect(redeem).toHaveProperty('disabled', false);
    await act(async () => {
      fireEvent.click(redeem);
    });
    expect(mockRedeem).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromAddress: mockAccount.address,
          code: 'test-coupon',
        }),
      }),
    );
    expect(redeem).toHaveProperty('disabled', true);
    expect(onClose).not.toHaveBeenCalled();
    view.unmount();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith({
      isResourceClaimed: true,
      isResourceRedeemed: true,
    });
  });

  it('does not show the previous address claim after selecting another account', async () => {
    mockClaim.mockResolvedValue({ success: true });
    const view = render(inlineCenter());
    const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
    await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
      timeout: 3000,
    });
    fireEvent.click(claim);
    expect(await screen.findByText('claimed')).toBeTruthy();

    mockActiveAccount = {
      account: {
        ...mockAccount,
        id: 'hd-1--account-2',
        address: 'second-address',
      },
      network: mockNetwork,
    };
    view.rerender(inlineCenter());
    expect(screen.queryByText('claimed')).toBeNull();
    expect(screen.queryByText('valid')).toBeNull();
    await waitFor(
      () =>
        expect(screen.getByTestId(RewardCenterTestIDs.claimBtn)).toHaveProperty(
          'disabled',
          false,
        ),
      { timeout: 3000 },
    );
  });

  it.each([undefined, { success: false, resMsg: 'failed' }])(
    'keeps an unsuccessful claim retryable (%j)',
    async (response) => {
      mockClaim.mockResolvedValue(response);
      render(inlineCenter());
      const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
      await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
        timeout: 3000,
      });
      await act(async () => {
        fireEvent.click(claim);
      });
      expect(screen.getByText('unclaimed')).toBeTruthy();
      expect(screen.queryByText('valid')).toBeNull();
      expect(claim).toHaveProperty('disabled', false);
    },
  );

  it('keeps the code for retry when redemption returns an empty response', async () => {
    mockRedeem.mockResolvedValue(undefined);
    const view = render(inlineCenter());
    mockRedeemCode = 'test-coupon';
    view.rerender(inlineCenter());
    const redeem = await screen.findByTestId(RewardCenterTestIDs.redeemBtn);
    await waitFor(() => expect(redeem).toHaveProperty('disabled', false));
    await act(async () => {
      fireEvent.click(redeem);
    });
    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(mockRedeemCode).toBe('test-coupon');
    expect(redeem).toHaveProperty('disabled', false);
  });
});
