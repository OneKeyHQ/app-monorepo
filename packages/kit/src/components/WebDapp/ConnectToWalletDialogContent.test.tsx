/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IWalletConnectDappConnectionProgress } from '@onekeyhq/shared/src/walletConnect/diagnostics';

import { OnboardingTestIDs } from '../../views/Onboardingv2/testIDs';

import { ConnectToWalletDialogContent } from './ConnectToWalletDialogContent';

let mockLoading = true;
let mockIsNative = true;
let mockProgress: IWalletConnectDappConnectionProgress | undefined;
const mockGetDappProgress = jest.fn<
  Promise<IWalletConnectDappConnectionProgress>,
  []
>();
let mockPoll: (() => Promise<unknown>) | undefined;

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    Button: Stack,
    Spinner: () => <span>Loading</span>,
    Icon: () => null,
    useTheme: () => ({ text: { val: '#ffffff' } }),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useOnboardingConnectWalletLoadingAtom: () => [mockLoading],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceWalletConnect: {
      getDappSideConnectionProgress: () => mockGetDappProgress(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<unknown>) => {
    mockPoll = method;
    return { result: mockProgress };
  },
}));

beforeEach(() => {
  mockLoading = true;
  mockIsNative = true;
  mockPoll = undefined;
  mockProgress = {
    attemptId: 1,
    attempt: 6,
    lastFailedAttempt: 5,
    connected: false,
    connectedDuringAttempt: false,
    snapshotFailed: false,
    relayUrl: 'wss://relay.walletconnect.org',
  };
  mockGetDappProgress.mockReset().mockResolvedValue(mockProgress);
});

function content(
  onExhausted = jest.fn(async () => undefined),
  isWalletConnect = true,
) {
  return (
    <ConnectToWalletDialogContent
      isWalletConnect={isWalletConnect}
      onSocketProgressExhausted={onExhausted}
      onRetryPress={jest.fn()}
    />
  );
}

it('uses the DApp socket source and the shared socket progress view', async () => {
  render(content());
  await mockPoll?.();
  expect(mockGetDappProgress).toHaveBeenCalledTimes(1);
  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toBe(`${ETranslations.transfer_transfer_server_status_connecting} (6/10)`);
  expect(screen.getByTestId('walletconnect-connection-relay').textContent).toBe(
    'wss://relay.walletconnect.org',
  );
  expect(
    screen.queryByText(
      ETranslations.global_connect_to_wallet_confirm_to_proceed,
    ),
  ).toBeNull();
});

it.each([
  { connected: true },
  { connectedDuringAttempt: true },
  { connected: undefined },
  { attempt: 0 },
  { snapshotFailed: true },
  { attemptId: undefined },
])(
  'shows preparation without a retry count when socket progress is not applicable: %j',
  (patch) => {
    mockProgress = { ...mockProgress!, ...patch };
    const onExhausted = jest.fn(async () => undefined);
    render(content(onExhausted));
    expect(screen.getByText(ETranslations.global_preparing)).toBeTruthy();
    expect(screen.queryByTestId('walletconnect-connection-relay')).toBeNull();
    expect(onExhausted).not.toHaveBeenCalled();
  },
);

it('keeps preparation usable when the diagnostics RPC fails', async () => {
  mockProgress = undefined;
  mockGetDappProgress.mockRejectedValue(new Error('RPC unavailable'));
  render(content());
  await expect(mockPoll?.()).resolves.toBeUndefined();
  expect(screen.getByText(ETranslations.global_preparing)).toBeTruthy();
  expect(screen.queryByTestId('walletconnect-connection-relay')).toBeNull();
});

it('ends the progress display once after the tenth failure, not when attempt ten begins', () => {
  const onExhausted = jest.fn(async () => undefined);
  mockProgress = { ...mockProgress!, attempt: 10, lastFailedAttempt: 9 };
  const view = render(content(onExhausted));
  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toContain('(10/10)');
  expect(onExhausted).not.toHaveBeenCalled();

  mockProgress = { ...mockProgress, lastFailedAttempt: 10 };
  view.rerender(content(onExhausted));
  expect(onExhausted).toHaveBeenCalledTimes(1);
  mockProgress = { ...mockProgress, attempt: 11 };
  view.rerender(content(onExhausted));
  expect(onExhausted).toHaveBeenCalledTimes(1);
});

it('preserves confirmation copy for a selected injected wallet without polling sockets', () => {
  render(content(undefined, false));
  expect(
    screen.getByText(ETranslations.global_connect_to_wallet_confirm_to_proceed),
  ).toBeTruthy();
  expect(mockPoll).toBeUndefined();
});

it('limits socket progress to native WalletConnect flows', () => {
  mockIsNative = false;
  render(content());
  expect(
    screen.getByTestId(OnboardingTestIDs.connectExternalWalletLoadingDialog),
  ).toBeTruthy();
  expect(
    screen.getByTestId(OnboardingTestIDs.connectExternalWalletLoadingMessage)
      .textContent,
  ).toBe(ETranslations.global_preparing);
  expect(mockPoll).toBeUndefined();
});

it('uses a connection error, not a missing confirmation, when setup fails', () => {
  mockLoading = false;
  render(content());
  expect(screen.getByText(ETranslations.global_connection_failed)).toBeTruthy();
  expect(screen.getByText(ETranslations.global_retry)).toBeTruthy();
  expect(mockPoll).toBeUndefined();
});
