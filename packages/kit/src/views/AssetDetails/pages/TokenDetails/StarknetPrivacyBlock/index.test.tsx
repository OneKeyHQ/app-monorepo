/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import StarknetPrivacyBlock from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/StarknetPrivacyBlock';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';
import {
  EStrk20ErrorCode,
  EStrk20ErrorRetry,
  EStrk20OptInStatus,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IStrk20PrivateBalances } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IToken } from '@onekeyhq/shared/types/token';

type IMockProps = {
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  children?: ReactNode;
  label?: ReactNode;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Text = ({ children, testID }: IMockProps) => (
    <span data-testid={testID}>{children}</span>
  );
  const View = ({ children, testID }: IMockProps) => (
    <div data-testid={testID}>{children}</div>
  );
  const Button = ({ children, testID, onPress, disabled }: IMockProps) => (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
    >
      {children}
    </button>
  );
  return {
    Button,
    Icon: () => null,
    SizableText: Text,
    XStack: View,
    YStack: View,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStarknetPrivacy: {} },
}));

const mockNavigate = jest.fn();
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockNavigate }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions',
  () => {
    const View = ({ children }: IMockProps) => <div>{children}</div>;
    const Pressable = ({ testID, onPress, disabled, label }: IMockProps) => (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
      >
        {label}
      </button>
    );
    return {
      ActionItem: Pressable,
      RawActions: Object.assign(View, { Send: Pressable, Receive: Pressable }),
    };
  },
);

jest.mock('../TokenDetailsBalanceHero', () => ({
  __esModule: true,
  default: ({
    balanceParsed,
    sync,
  }: {
    balanceParsed?: string;
    sync?: { onRefresh?: () => void; isRefreshing?: boolean };
  }) => (
    <div>
      <span data-testid="private-hero">{balanceParsed ?? 'unknown'}</span>
      {sync ? (
        <button
          type="button"
          data-testid="token-privacy-balance-refresh"
          onClick={sync.onRefresh}
          disabled={sync.isRefreshing}
        >
          Refresh
        </button>
      ) : null}
    </div>
  ),
}));

jest.mock('../TokenPrivacyPanel', () => ({
  TokenPrivacyPanel: ({
    state,
    enableUnavailable,
    busy,
    onEnable,
    onSync,
    actionLabel,
    description,
    detail,
    title,
  }: {
    state: string;
    enableUnavailable?: boolean;
    busy?: boolean;
    onEnable?: () => void;
    onSync?: () => void;
    actionLabel?: string;
    description?: string;
    detail?: string;
    title?: string;
  }) => (
    <div>
      <span data-testid="panel-state">{state}</span>
      <span data-testid="panel-title">{title}</span>
      <span data-testid="panel-description">{description}</span>
      <span data-testid="panel-detail">{detail}</span>
      {onSync ? (
        <button type="button" data-testid="retry" onClick={onSync}>
          {actionLabel}
        </button>
      ) : null}
      {state === 'disabled' && !enableUnavailable && onEnable ? (
        <button
          type="button"
          data-testid="enable"
          onClick={onEnable}
          disabled={busy}
        >
          Enable
        </button>
      ) : null}
    </div>
  ),
}));

const mockReload = jest.fn();
const mockOptIn = jest.fn();
const mockReceive = jest.fn();
let mockAvailable = true;
let mockIsOptingIn = false;
let mockStateLoading = false;
let mockStatus = EStrk20OptInStatus.Registered;
let mockRegisterTxFailed = false;
let mockRegisterTxid: string | undefined;
let mockRegisteredPublicKey: string | undefined;
let mockOptInError: ETranslationsMock | undefined;
let mockBalanceError: ETranslations | ETranslationsMock | undefined;
let mockBalanceErrorCode: EStrk20ErrorCode | undefined;
let mockBalances: IStrk20PrivateBalances | undefined;
let mockSequencingStatus = EStrk20SequencingStatus.Ready;

jest.mock(
  '@onekeyhq/kit/src/views/StarknetPrivacy/hooks/useStarknetPrivacy',
  () => ({
    isStrk20Registered: (state?: { optInStatus: string }) =>
      state?.optInStatus === 'registered',
    isStrk20RegisterPending: (state?: { optInStatus: string }) =>
      state?.optInStatus === 'registerPending',
    isStrk20Mismatch: (state?: { optInStatus: string }) =>
      state?.optInStatus === 'mismatch',
    isStrk20SequencingWaiting: (state?: { status: string }) =>
      state?.status === 'waiting',
    useStarknetPrivacyAvailability: () => ({ isAvailable: mockAvailable }),
    useStarknetPrivacyAccountState: () => ({
      state: {
        optInStatus: mockStatus,
        registerTxFailed: mockRegisterTxFailed,
        registerTxid: mockRegisterTxid,
        registeredPublicKey: mockRegisteredPublicKey,
      },
      isLoading: mockStateLoading,
      reload: mockReload,
    }),
    useStarknetPrivateBalances: () => ({
      balances: mockBalances,
      errorKey: mockBalanceError,
      errorCode:
        mockBalanceError ===
        ETranslations.privacy_balance_verification_pending__msg
          ? EStrk20ErrorCode.Locked
          : mockBalanceErrorCode,
      reload: mockReload,
      refreshSilently: jest.fn(),
    }),
    useStarknetPrivacySequencing: () => ({
      sequencing: { status: mockSequencingStatus },
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/StarknetPrivacy/hooks/useStarknetPrivacyOptIn',
  () => ({
    useStarknetPrivacyOptIn: () => ({
      optIn: mockOptIn,
      isOptingIn: mockIsOptingIn,
      optInErrorKey: mockOptInError,
      optInRetryable: EStrk20ErrorRetry.No,
    }),
  }),
);

const token: IToken = {
  address: '0xab',
  decimals: 18,
  symbol: 'STRK',
  name: 'Starknet Token',
  isNative: true,
};

function renderBlock(receiveDisabled = false) {
  return render(
    <StarknetPrivacyBlock
      networkId="starknet--mainnet"
      accountId="test-account"
      accountAddress="0x12"
      token={token}
      publicBalanceParsed="66.2"
      onReceive={mockReceive}
      receiveDisabled={receiveDisabled}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAvailable = true;
  mockIsOptingIn = false;
  mockStateLoading = false;
  mockStatus = EStrk20OptInStatus.Registered;
  mockRegisterTxFailed = false;
  mockRegisterTxid = undefined;
  mockRegisteredPublicKey = undefined;
  mockOptInError = undefined;
  mockBalanceError = undefined;
  mockBalanceErrorCode = undefined;
  mockSequencingStatus = EStrk20SequencingStatus.Ready;
  mockBalances = {
    byToken: { [`0x${'ab'.padStart(64, '0')}`]: '10000000000000000000' },
    blockNumber: 100,
    noteCount: 1,
  };
});

it('shows an enable card without automatically opting in', () => {
  mockStatus = EStrk20OptInStatus.None;
  const ui = renderBlock();
  expect(ui.getByTestId('panel-state').textContent).toBe('disabled');
  expect(ui.getByTestId('panel-description').textContent).toBe('');
  expect(ui.queryByTestId('private-hero')).toBeNull();
  expect(mockOptIn).not.toHaveBeenCalled();
  fireEvent.click(ui.getByTestId('enable'));
  expect(mockOptIn).toHaveBeenCalledTimes(1);
});

it('does not offer enable or spending actions to an unavailable account', () => {
  mockAvailable = false;
  const ui = renderBlock();
  expect(ui.queryByTestId('enable')).toBeNull();
  expect(ui.queryByTestId('starknet-privacy-send')).toBeNull();
});

it('offers resume for an existing registration without a description', () => {
  mockStatus = EStrk20OptInStatus.None;
  mockRegisteredPublicKey = '0x123';
  const ui = renderBlock();
  expect(ui.getByTestId('panel-title').textContent).toBe(
    ETranslationsMock.starknet_privacy_resume_sync,
  );
  expect(ui.getByTestId('panel-description').textContent).toBe('');
  fireEvent.click(ui.getByTestId('enable'));
  expect(mockOptIn).toHaveBeenCalledTimes(1);
});

it('hides registration retry only after a non-retryable error', () => {
  mockStatus = EStrk20OptInStatus.None;
  mockOptInError = ETranslationsMock.starknet_privacy_error_key_mismatch;
  const ui = renderBlock();
  expect(ui.queryByTestId('enable')).toBeNull();
});

it('keeps registration pending without showing a zero private balance', () => {
  mockStatus = EStrk20OptInStatus.RegisterPending;
  mockRegisterTxid = '0x123';
  const ui = renderBlock();
  expect(
    ui.getByTestId('starknet-privacy-registration-pending'),
  ).not.toBeNull();
  expect(ui.queryByTestId('private-hero')).toBeNull();
  expect(ui.queryByTestId('enable')).toBeNull();
  expect(mockOptIn).not.toHaveBeenCalled();
});

it('shows a confirmed registration failure with a deliberate retry', () => {
  mockStatus = EStrk20OptInStatus.Consented;
  mockRegisterTxFailed = true;
  mockRegisterTxid = '0x123';
  const ui = renderBlock();
  expect(ui.getByTestId('panel-description').textContent).toBe(
    ETranslationsMock.starknet_privacy_activation_failed_title,
  );
  expect(ui.queryByTestId('private-hero')).toBeNull();
  fireEvent.click(ui.getByTestId('enable'));
  expect(mockOptIn).toHaveBeenCalledTimes(1);
});

it('hides the stale enable action while rechecking activation on return', () => {
  mockStatus = EStrk20OptInStatus.Consented;
  mockStateLoading = true;
  const ui = renderBlock();
  expect(ui.getByTestId('panel-state').textContent).toBe('preparing');
  expect(ui.queryByTestId('enable')).toBeNull();
});

it('keeps the same enable control disabled while the action is running', () => {
  mockStatus = EStrk20OptInStatus.None;
  mockIsOptingIn = true;
  const ui = renderBlock();
  expect(ui.getByTestId('panel-state').textContent).toBe('disabled');
  expect(ui.getByTestId('enable').hasAttribute('disabled')).toBe(true);
  expect(ui.queryByTestId('private-hero')).toBeNull();
});

it('shows an unlock action when the private balance needs verification', () => {
  mockBalanceError = ETranslations.privacy_balance_verification_pending__msg;
  mockBalances = undefined;
  const ui = renderBlock();
  expect(ui.queryByTestId('panel-state')).toBeNull();
  expect(ui.queryByTestId('enable')).toBeNull();
  expect(ui.getByTestId('private-hero').textContent).toBe('unknown');
  const unlock = ui.getByTestId('starknet-privacy-unlock');
  expect(unlock.textContent).toBe(ETranslations.global_unlock);
  expect(ui.queryByTestId('token-privacy-balance-refresh')).toBeNull();
  expect(ui.queryByTestId('starknet-privacy-details')).toBeNull();
  expect(mockReload).not.toHaveBeenCalled();
  fireEvent.click(unlock);
  expect(mockReload).toHaveBeenCalledTimes(1);
  expect(mockOptIn).not.toHaveBeenCalled();
});

it('never offers registration when the viewing key does not match', () => {
  mockStatus = EStrk20OptInStatus.Mismatch;
  const ui = renderBlock();
  expect(ui.getByTestId('panel-state').textContent).toBe('error');
  expect(ui.queryByTestId('enable')).toBeNull();
  expect(ui.queryByTestId('private-hero')).toBeNull();
});

it('shows the private balance and opens private sending', () => {
  const ui = renderBlock();
  expect(ui.getByTestId('private-hero').textContent).toBe('10');
  expect(ui.queryByTestId('starknet-privacy-unlock')).toBeNull();
  fireEvent.click(ui.getByTestId('starknet-privacy-send'));
  expect(mockNavigate.mock.calls[0][1]).toMatchObject({
    screen: EModalSignatureConfirmRoutes.TxDataInput,
    params: { sendOptions: { validateRecipient: expect.any(Function) } },
  });
});

it('keeps account metadata off the main page and offers balance refresh', () => {
  const ui = renderBlock();
  expect(ui.queryByTestId('starknet-privacy-balance-public')).toBeNull();
  expect(ui.queryByTestId('starknet-privacy-balance-total')).toBeNull();
  expect(ui.queryByTestId('token-privacy-open-preview')).toBeNull();
  expect(ui.queryByTestId('starknet-privacy-enabled')).toBeNull();
  expect(ui.queryByTestId('starknet-privacy-details')).toBeNull();
  expect(ui.queryByTestId('starknet-privacy-account-details')).toBeNull();
  fireEvent.click(ui.getByTestId('token-privacy-balance-refresh'));
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('opens deposit from the private tab without unlocking the private balance', () => {
  mockBalanceError = ETranslations.privacy_balance_verification_pending__msg;
  mockBalances = undefined;
  const ui = renderBlock();
  fireEvent.click(ui.getByTestId('starknet-privacy-deposit'));
  expect(mockNavigate.mock.calls[0][1]).toMatchObject({
    screen: EModalSignatureConfirmRoutes.TxAmountInput,
    params: {
      recipientAddress: '0x12',
      sendOptions: { amount: { loadBalance: undefined } },
    },
  });
  expect(mockReload).not.toHaveBeenCalled();
});

it('allows receiving before private balances are unlocked', () => {
  mockBalanceError = ETranslations.privacy_balance_verification_pending__msg;
  mockBalances = undefined;
  const ui = renderBlock();
  expect(
    ui.getByTestId('starknet-privacy-receive').hasAttribute('disabled'),
  ).toBe(false);
  fireEvent.click(ui.getByTestId('starknet-privacy-receive'));
  expect(mockReceive).toHaveBeenCalledTimes(1);
  expect(mockReload).not.toHaveBeenCalled();
  expect(mockOptIn).not.toHaveBeenCalled();
});

it('allows receiving into an empty private balance', () => {
  mockBalances = { byToken: {}, blockNumber: 100, noteCount: 0 };
  const ui = renderBlock();
  fireEvent.click(ui.getByTestId('starknet-privacy-receive'));
  expect(mockReceive).toHaveBeenCalledTimes(1);
});

it('retains the existing receive restrictions', () => {
  const ui = renderBlock(true);
  expect(
    ui.getByTestId('starknet-privacy-receive').hasAttribute('disabled'),
  ).toBe(true);
  fireEvent.click(ui.getByTestId('starknet-privacy-receive'));
  expect(mockReceive).not.toHaveBeenCalled();
});

it('opens withdrawal through the private flow', () => {
  const ui = renderBlock();
  fireEvent.click(ui.getByTestId('starknet-privacy-withdraw'));
  expect(mockNavigate.mock.calls[0][1]).toMatchObject({
    screen: EModalSignatureConfirmRoutes.TxAmountInput,
    params: {
      recipientAddress: '0x12',
      sendOptions: { amount: { loadBalance: expect.any(Function) } },
    },
  });
});

it('keeps the last known balance after a failed refresh and disables private spending', () => {
  mockBalanceError = ETranslationsMock.starknet_privacy_error_unknown;
  mockBalanceErrorCode = EStrk20ErrorCode.Unknown;
  const ui = renderBlock();
  expect(ui.getByTestId('private-hero').textContent).toBe('10');
  expect(ui.getByTestId('panel-title').textContent).toBe(
    ETranslations.global_sync_error,
  );
  expect(ui.getByTestId('panel-detail').textContent).toBe('');
  expect(ui.getByTestId('starknet-privacy-send').hasAttribute('disabled')).toBe(
    true,
  );
});

it('shows a known error for an unavailable balance and allows retry', () => {
  mockBalances = undefined;
  mockBalanceError =
    ETranslationsMock.starknet_privacy_error_service_overloaded;
  mockBalanceErrorCode = EStrk20ErrorCode.ServiceOverloaded;
  const ui = renderBlock();
  expect(ui.getByTestId('panel-title').textContent).toBe(
    ETranslations.privacy_balance_unavailable__msg,
  );
  expect(ui.getByTestId('panel-detail').textContent).toBe(mockBalanceError);
  fireEvent.click(ui.getByTestId('retry'));
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it('disables proof actions until sequencing is ready', () => {
  mockSequencingStatus = EStrk20SequencingStatus.Unavailable;
  const ui = renderBlock();
  expect(ui.getByTestId('starknet-privacy-send').hasAttribute('disabled')).toBe(
    true,
  );
  expect(
    ui.getByTestId('starknet-privacy-deposit').hasAttribute('disabled'),
  ).toBe(true);
  expect(
    ui.getByTestId('starknet-privacy-withdraw').hasAttribute('disabled'),
  ).toBe(true);
});

it('keeps a missing scan unknown and prevents private withdrawals', () => {
  mockBalances = undefined;
  const ui = renderBlock();
  expect(ui.getByTestId('private-hero').textContent).toBe('unknown');
  expect(
    ui.getByTestId('starknet-privacy-withdraw').hasAttribute('disabled'),
  ).toBe(true);
});

it('shows zero only after a successful empty scan', () => {
  mockBalances = { byToken: {}, blockNumber: 100, noteCount: 0 };
  const ui = renderBlock();
  expect(ui.getByTestId('private-hero').textContent).toBe('0');
  expect(ui.getByTestId('starknet-privacy-send').hasAttribute('disabled')).toBe(
    true,
  );
});
