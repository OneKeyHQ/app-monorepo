/** @jest-environment jsdom */
// cspell:ignore Actived

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RewardCenterTestIDs } from '../testIDs';

import RewardCenter, {
  TronRewardCenterContent,
  clearTronPoolCache,
} from './RewardCenter';

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
// The proxy answers a delivered issuance with an empty body (null).
type IMockIssuanceResponse =
  | { success: boolean; resMsg?: string }
  | null
  | undefined;
const mockClaim = jest.fn<Promise<IMockIssuanceResponse>, []>();
let mockRedeemCode = '';
// The redeem input's change handler as Form.Field receives it: the field
// stores whatever this returns.
let mockRedeemInputOnChangeText: ((text: string) => unknown) | undefined;
let mockActivated = true;
let mockInventoryFails = false;
const mockPushModal = jest.fn();
const mockResetField = jest.fn();
const mockRedeem = jest.fn<Promise<IMockIssuanceResponse>, [unknown]>();
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
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
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
    Input: ({ onChangeText }: { onChangeText?: (text: string) => unknown }) => {
      mockRedeemInputOnChangeText = onChangeText;
      return null;
    },
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
      resetField: mockResetField,
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
        if (body.url === '/api/tronRent/isReceived') {
          if (mockInventoryFails) {
            throw new OneKeyLocalError('Inventory request failed');
          }
          return mockInventory;
        }
        if (body.url === '/api/account')
          return { code: 0, data: { isActived: mockActivated } };
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
    pushModal: mockPushModal,
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
    clearTronPoolCache();
  });
  afterEach(() => {
    mockActiveAccount = {};
    mockActivated = true;
    mockInventoryFails = false;
    mockInventory.monthRemain = 2;
    mockInventory.monthIPRemain = 2;
  });

  function inlineCenter(onClose?: () => void, onIssued?: () => void) {
    return (
      <TronRewardCenterContent
        params={{ accountId: '', networkId: mockNetwork.id, onClose }}
        onIssued={onIssued}
        renderInline={({ claimed, validUntil, claimDetails }) => (
          <>
            <span>{claimed ? 'claimed' : 'unclaimed'}</span>
            <span>
              {claimDetails.inventoryLoading
                ? 'inventory-loading'
                : 'inventory-ready'}
            </span>
            <span>
              pool:{claimDetails.remaining ?? 'none'}/
              {claimDetails.total ?? 'none'}
            </span>
            <span>monthly:{claimDetails.monthlyRemaining ?? 'none'}</span>
            {validUntil ? <span>valid</span> : null}
            {claimDetails.claimButton}
            {claimDetails.redeemField}
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
    expect(redeem.textContent).toBe(ETranslations.redemption_success_title);
    view.unmount();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith({
      isResourceClaimed: true,
      isResourceRedeemed: true,
    });
  });

  it.each([
    ['monthRemain', ETranslations.tron_energy_claim_limit_reached_notice],
    ['monthIPRemain', ETranslations.tron_energy_claim_limit_ip_reached_notice],
  ] as const)(
    'shows the %s limit on the daily button only',
    async (field, label) => {
      mockInventory[field] = 0;
      mockRedeemCode = 'test-coupon';
      render(inlineCenter());
      const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
      await waitFor(() => expect(claim.textContent).toBe(label), {
        timeout: 3000,
      });
      expect(claim).toHaveProperty('disabled', true);
      expect(screen.getByTestId(RewardCenterTestIDs.redeemBtn)).toHaveProperty(
        'disabled',
        false,
      );
    },
  );

  it('offers TRX top-up on both tabs for an inactive account', async () => {
    mockActivated = false;
    render(inlineCenter());
    const actions = await screen.findAllByTestId(RewardCenterTestIDs.topUpBtn);
    expect(actions).toHaveLength(2);
    fireEvent.click(actions[0]);
    expect(mockPushModal).toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockRedeem).not.toHaveBeenCalled();
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

  // Today's pool is shared by every address: only the first open of the
  // session may show it as loading. The monthly quota belongs to an address
  // and does reload.
  it('keeps the daily pool on screen while another account loads', async () => {
    const view = render(inlineCenter());
    expect(await screen.findByText('pool:none/none')).toBeTruthy();
    const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
    await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
      timeout: 3000,
    });
    expect(screen.getByText('pool:1/500')).toBeTruthy();
    expect(screen.getByText('monthly:2')).toBeTruthy();

    mockActiveAccount = {
      account: {
        ...mockAccount,
        id: 'hd-1--account-2',
        address: 'second-address',
      },
      network: mockNetwork,
    };
    view.rerender(inlineCenter());

    // The second account's inventory is still on its way. Its request has
    // not even started on this frame, which must not read as "came back
    // empty": no retry button, and the claim button stays in place.
    expect(screen.getByText('inventory-loading')).toBeTruthy();
    expect(screen.getByText('pool:1/500')).toBeTruthy();
    expect(screen.getByText('monthly:none')).toBeTruthy();
    expect(
      screen.queryByTestId(RewardCenterTestIDs.retryInventoryBtn),
    ).toBeNull();
    expect(screen.getByTestId(RewardCenterTestIDs.claimBtn)).toHaveProperty(
      'disabled',
      true,
    );

    await waitFor(
      () => expect(screen.getByText('inventory-ready')).toBeTruthy(),
      {
        timeout: 3000,
      },
    );
    expect(screen.getByText('pool:1/500')).toBeTruthy();
    expect(screen.getByText('monthly:2')).toBeTruthy();
  });

  it('offers a retry once the inventory request has failed', async () => {
    mockInventoryFails = true;
    render(inlineCenter());

    const retry = await screen.findByTestId(
      RewardCenterTestIDs.retryInventoryBtn,
      undefined,
      { timeout: 3000 },
    );
    expect(screen.getByText('inventory-ready')).toBeTruthy();
    expect(screen.getByText('pool:none/none')).toBeTruthy();

    mockInventoryFails = false;
    fireEvent.click(retry);

    await waitFor(
      () =>
        expect(screen.getByTestId(RewardCenterTestIDs.claimBtn)).toHaveProperty(
          'disabled',
          false,
        ),
      { timeout: 3000 },
    );
    expect(screen.getByText('pool:1/500')).toBeTruthy();
  });

  it('shows the last known pool at once when the page is reopened', async () => {
    const first = render(inlineCenter());
    const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
    await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
      timeout: 3000,
    });
    first.unmount();

    render(inlineCenter());

    expect(await screen.findByText('inventory-loading')).toBeTruthy();
    expect(screen.getByText('pool:1/500')).toBeTruthy();
  });

  it('carries the pool running dry over to the next account', async () => {
    mockInventory.remaining = 0;
    try {
      const view = render(inlineCenter());
      const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
      await waitFor(
        () =>
          expect(claim.textContent).toBe(ETranslations.wallet_subsidy_all_used),
        { timeout: 3000 },
      );

      mockActiveAccount = {
        account: {
          ...mockAccount,
          id: 'hd-1--account-2',
          address: 'second-address',
        },
        network: mockNetwork,
      };
      view.rerender(inlineCenter());

      // No flash of "Claim" for a pool that is known to be empty.
      expect(screen.getByText('inventory-loading')).toBeTruthy();
      expect(screen.getByTestId(RewardCenterTestIDs.claimBtn).textContent).toBe(
        ETranslations.wallet_subsidy_all_used,
      );
    } finally {
      mockInventory.remaining = 1;
    }
  });

  // The view keeps the space of the inventory rows while this flag is set,
  // so it must cover the whole wait and never drop to "no inventory" first.
  it('reports the inventory as loading until it arrives', async () => {
    render(inlineCenter());
    expect(await screen.findByText('inventory-loading')).toBeTruthy();
    expect(screen.queryByTestId(RewardCenterTestIDs.addAccountBtn)).toBeNull();
    const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
    await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
      timeout: 3000,
    });
    expect(screen.getByText('inventory-ready')).toBeTruthy();
  });

  it('reports each successful claim and redemption so records can refresh', async () => {
    mockClaim.mockResolvedValue({ success: true });
    mockRedeem.mockResolvedValue({ success: true });
    const onIssued = jest.fn();
    const view = render(inlineCenter(undefined, onIssued));
    const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
    await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
      timeout: 3000,
    });
    expect(onIssued).not.toHaveBeenCalled();

    fireEvent.click(claim);
    expect(await screen.findByText('claimed')).toBeTruthy();
    expect(onIssued).toHaveBeenCalledTimes(1);

    mockRedeemCode = 'test-coupon';
    view.rerender(inlineCenter(undefined, onIssued));
    await act(async () => {
      fireEvent.click(screen.getByTestId(RewardCenterTestIDs.redeemBtn));
    });
    expect(onIssued).toHaveBeenCalledTimes(2);
  });

  // The live proxy answers a delivered claim with an empty body and throws
  // for every rejection (e.g. code 110 "already claimed within 24 hours").
  it.each([null, undefined])(
    'treats an empty success body as a delivered claim (%j)',
    async (response) => {
      mockClaim.mockResolvedValue(response);
      const onIssued = jest.fn();
      render(inlineCenter(undefined, onIssued));
      const claim = await screen.findByTestId(RewardCenterTestIDs.claimBtn);
      await waitFor(() => expect(claim).toHaveProperty('disabled', false), {
        timeout: 3000,
      });
      fireEvent.click(claim);
      expect(await screen.findByText('claimed')).toBeTruthy();
      expect(screen.getByText('valid')).toBeTruthy();
      expect(claim).toHaveProperty('disabled', true);
      expect(onIssued).toHaveBeenCalledTimes(1);
      fireEvent.click(claim);
      expect(mockClaim).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['an explicit failure body', { success: false, resMsg: 'failed' }],
    ['a rejected request', new Error('already claimed within 24 hours')],
  ])('keeps an unsuccessful claim retryable (%s)', async (_name, outcome) => {
    if (outcome instanceof Error) {
      mockClaim.mockRejectedValue(outcome);
    } else {
      mockClaim.mockResolvedValue(outcome);
    }
    const onIssued = jest.fn();
    render(inlineCenter(undefined, onIssued));
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
    expect(onIssued).not.toHaveBeenCalled();
  });

  it('treats an empty success body as a completed redemption', async () => {
    mockRedeem.mockResolvedValue(null);
    const onIssued = jest.fn();
    const view = render(inlineCenter(undefined, onIssued));
    mockRedeemCode = 'test-coupon';
    view.rerender(inlineCenter(undefined, onIssued));
    const redeem = await screen.findByTestId(RewardCenterTestIDs.redeemBtn);
    await waitFor(() => expect(redeem).toHaveProperty('disabled', false));
    await act(async () => {
      fireEvent.click(redeem);
    });
    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(redeem.textContent).toBe(ETranslations.redemption_success_title);
    expect(onIssued).toHaveBeenCalledTimes(1);
  });

  it('hands the next code through to the form after a redemption', async () => {
    mockRedeem.mockResolvedValue({ success: true });
    mockRedeemCode = 'test-coupon';
    render(inlineCenter());
    const redeem = await screen.findByTestId(RewardCenterTestIDs.redeemBtn);
    await waitFor(() => expect(redeem).toHaveProperty('disabled', false));
    await act(async () => {
      fireEvent.click(redeem);
    });
    expect(redeem.textContent).toBe(ETranslations.redemption_success_title);

    // Pasting the next code is a single change event. A handler that
    // returned nothing would store "no value" and leave the button disabled.
    let stored: unknown;
    act(() => {
      stored = mockRedeemInputOnChangeText?.('next-coupon');
    });
    expect(stored).toBe('next-coupon');
  });

  it('keeps a code entered while the previous redemption was still in flight', async () => {
    let finishRedeem!: (value: IMockIssuanceResponse) => void;
    mockRedeem.mockReturnValue(
      new Promise<IMockIssuanceResponse>((resolve) => {
        finishRedeem = resolve;
      }),
    );
    mockRedeemCode = 'first-coupon';
    render(inlineCenter());
    const redeem = await screen.findByTestId(RewardCenterTestIDs.redeemBtn);
    await waitFor(() => expect(redeem).toHaveProperty('disabled', false));
    fireEvent.click(redeem);
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledTimes(1));

    // The input stays editable during the request.
    mockRedeemCode = 'second-coupon';
    await act(async () => {
      finishRedeem({ success: true });
    });

    expect(mockRedeemCode).toBe('second-coupon');
  });

  it('keeps a code entered for another account when the earlier redemption completes', async () => {
    let finishRedeem!: (value: IMockIssuanceResponse) => void;
    mockRedeem.mockReturnValue(
      new Promise<IMockIssuanceResponse>((resolve) => {
        finishRedeem = resolve;
      }),
    );
    mockRedeemCode = 'shared-coupon';
    const view = render(inlineCenter());
    const redeem = await screen.findByTestId(RewardCenterTestIDs.redeemBtn);
    await waitFor(() => expect(redeem).toHaveProperty('disabled', false));
    fireEvent.click(redeem);
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledTimes(1));

    // Same text, another account: it is the second account's input now.
    mockActiveAccount = {
      account: {
        ...mockAccount,
        id: 'hd-1--account-2',
        address: 'second-address',
      },
      network: mockNetwork,
    };
    view.rerender(inlineCenter());
    await act(async () => {
      finishRedeem({ success: true });
    });

    expect(mockRedeemCode).toBe('shared-coupon');
  });

  it('keeps the code for retry when the redemption request is rejected', async () => {
    mockRedeem.mockRejectedValue(new Error('invalid code'));
    const onIssued = jest.fn();
    const view = render(inlineCenter(undefined, onIssued));
    mockRedeemCode = 'test-coupon';
    view.rerender(inlineCenter(undefined, onIssued));
    const redeem = await screen.findByTestId(RewardCenterTestIDs.redeemBtn);
    await waitFor(() => expect(redeem).toHaveProperty('disabled', false));
    await act(async () => {
      fireEvent.click(redeem);
    });
    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(mockRedeemCode).toBe('test-coupon');
    expect(redeem).toHaveProperty('disabled', false);
    expect(onIssued).not.toHaveBeenCalled();
  });

  it('does not report a rejected redemption', async () => {
    mockRedeem.mockResolvedValue({ success: false, resMsg: 'invalid code' });
    const onIssued = jest.fn();
    const view = render(inlineCenter(undefined, onIssued));
    mockRedeemCode = 'test-coupon';
    view.rerender(inlineCenter(undefined, onIssued));
    const redeem = await screen.findByTestId(RewardCenterTestIDs.redeemBtn);
    await waitFor(() => expect(redeem).toHaveProperty('disabled', false));
    await act(async () => {
      fireEvent.click(redeem);
    });
    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(onIssued).not.toHaveBeenCalled();
  });
});
