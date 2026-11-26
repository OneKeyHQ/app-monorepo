/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { atom } from 'jotai';
import { AppState } from 'react-native';

import type { IDialogShowProps, IToastProps } from '@onekeyhq/components';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { getLocalSecretEnvelopeCredentialKey } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

import { getActiveWalletLocalSecretEnvelopeCredentialId } from '../../../components/AccountSelector/hooks/useWalletLocalSecretEnvelopePreflight';
import { WalletLocalSecretEnvelopeStatus } from '../../../components/AccountSelector/WalletLocalSecretEnvelopeStatus';
import {
  blockIfWalletLocalSecretEnvelopeUnavailable,
  clearWalletLocalSecretEnvelopeConfirmedReadableCache,
  getWalletLocalSecretEnvelopeUnavailableIssue,
} from '../../../components/LocalSecretEnvelopeRecovery/walletLocalSecretEnvelopeGuard';

import { LocalSecretEnvelopeErrorDialogContainer } from './LocalSecretEnvelopeErrorDialogContainer';

const mockToast = jest.fn((_props: IToastProps) => undefined);
const mockDialog = jest.fn((_props: IDialogShowProps) => undefined);
const mockNavigate = jest.fn<void, unknown[]>();
const mockAppIsLockedAtom = atom(false);
const mockPreflight = jest.fn<
  Promise<ILocalSecretEnvelopeCredentialIssue | null | undefined>,
  [unknown]
>();
let mockActiveWalletId: string | undefined;
let mockWalletIssues: Record<string, ILocalSecretEnvelopeCredentialIssue>;

jest.mock('@onekeyhq/components', () => {
  const Pressable = ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  );
  return {
    Badge: Object.assign(Pressable, {
      Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    }),
    Button: Pressable,
    Icon: () => null,
    Toast: {
      error: (props: IToastProps) => mockToast(props),
      dismiss: jest.fn(),
    },
    Dialog: { show: (props: IDialogShowProps) => mockDialog(props) },
    resetToRoute: (...args: unknown[]) => mockNavigate(...args),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({
      id,
      defaultMessage,
    }: {
      id: string;
      defaultMessage?: string;
    }) => defaultMessage ?? id,
  }),
}));

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: jest.fn() }),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  appIsLocked: { atom: () => mockAppIsLockedAtom },
  useAppIsLockedAtom: () => [false],
}));
jest.mock(
  '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData',
  () => ({
    ...jest.requireActual<
      typeof import('@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData')
    >('@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData'),
    getLocalSecretEnvelopeCredentialKey: (sessionId: string, id: string) =>
      `${sessionId}:${id}`,
  }),
);
jest.mock(
  '@onekeyhq/kit-bg/src/states/jotai/atoms/walletLocalSecretEnvelopeStatus',
  () => ({
    walletLocalSecretEnvelopeStatusAtom: {
      atom: () => atom({ sessionId: 'test-session', issues: mockWalletIssues }),
    },
    useWalletLocalSecretEnvelopeStatusAtom: () => [
      { sessionId: 'test-session', issues: mockWalletIssues },
    ],
  }),
);
jest.mock(
  '../../../components/AccountSelector/AccountSelectorProvider',
  () => ({
    AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) =>
      children,
  }),
);
jest.mock('../../../states/jotai/contexts/accountSelector/atoms', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      ready: !!mockActiveWalletId,
      wallet: { id: mockActiveWalletId },
    },
  }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  serviceAccount: {
    preflightWalletLocalSecretEnvelope: (params: unknown) =>
      mockPreflight(params),
  },
}));

const issue: ILocalSecretEnvelopeCredentialIssue = {
  credentialKey: 'opaque-wallet-key',
  reason: 'key-missing',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPreflight.mockReset();
  clearWalletLocalSecretEnvelopeConfirmedReadableCache();
  mockActiveWalletId = undefined;
  mockWalletIssues = {};
  AppState.currentState = 'active';
  jotaiDefaultStore.set(mockAppIsLockedAtom, false);
});

afterEach(() => {
  jest.useRealTimers();
});

it('deduplicates toast events and opens the onboarding welcome page on demand', async () => {
  render(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
    appEventBus.emit(EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast, {
      ...issue,
      walletName: 'Wallet B',
    });
    errorToastUtils.showToastOfError({
      className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
      data: { localSecretEnvelopeIssue: issue },
    });
    appEventBus.emit(
      EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast,
      issue,
    );
  });
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast.mock.calls[0][0].title).toBe(
    'Unable to access encrypted local data',
  );
  expect(mockToast.mock.calls[0][0].message).toBe('Wallet B');
  expect(mockDialog).not.toHaveBeenCalled();
  const actions = mockToast.mock.calls[0][0].actions;
  const action = Array.isArray(actions) ? actions[0] : actions;
  expect(action?.label).toBe(ETranslations.global_details);
  await act(async () => {
    await action?.onPress?.();
  });
  expect(mockDialog).toHaveBeenCalledTimes(1);
  expect(mockDialog.mock.calls[0][0]).toMatchObject({
    title: 'Unable to access encrypted local data',
    description:
      'This can happen after switching to a new device, transferring data, or reinstalling the app.\n\nPlease reimport your wallet.',
    onConfirmText: 'Import Wallet Again',
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  const confirm = mockDialog.mock.calls[0][0].onConfirm;
  const close = jest.fn(async () => undefined);
  await confirm?.({
    close,
    getForm: () => undefined,
    isExist: () => true,
    preventClose: jest.fn(),
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Onboarding, {
    screen: EOnboardingV2Routes.OnboardingV2,
    params: { screen: EOnboardingPagesV2.GetStarted },
  });
});

it('uses the same toast for the selected-wallet preflight', async () => {
  jest.useFakeTimers();
  mockActiveWalletId = 'hd-1';
  mockPreflight.mockResolvedValue({
    ...issue,
    reason: 'authentication-failed',
  });
  render(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(250);
  });
  expect(mockPreflight).toHaveBeenCalledWith(
    expect.objectContaining({ credentialId: 'hd-1' }),
  );
  expect(mockToast).toHaveBeenCalledTimes(1);
  expect(mockToast.mock.calls[0][0].title).toBe(
    'Unable to access encrypted local data',
  );
  expect(mockDialog).not.toHaveBeenCalled();
});

it('rechecks the selected wallet after an inconclusive startup preflight', async () => {
  jest.useFakeTimers();
  mockActiveWalletId = 'hd-1';
  mockPreflight.mockResolvedValueOnce(undefined).mockResolvedValueOnce(issue);
  render(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(250);
  });
  expect(mockPreflight).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(mockPreflight).toHaveBeenCalledTimes(2);
  expect(mockToast).toHaveBeenCalledTimes(1);
});

it('finishes preflight after a confirmed readable result', async () => {
  jest.useFakeTimers();
  mockActiveWalletId = 'hd-1';
  mockPreflight.mockResolvedValueOnce(null);
  render(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });
  expect(mockPreflight).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
});

it('replaces backup guidance with the recovery action for a wallet with a confirmed issue', async () => {
  const credentialId = 'hd-2';
  const credentialKey = getLocalSecretEnvelopeCredentialKey(
    'test-session',
    credentialId,
  );
  const renderWalletHeading = () => (
    <>
      <LocalSecretEnvelopeErrorDialogContainer />
      <WalletLocalSecretEnvelopeStatus
        credentialId={credentialId}
        compact
        fallback={<span>Not backed up</span>}
      />
    </>
  );
  const { rerender } = render(renderWalletHeading());
  expect(screen.queryByText('Not backed up')).not.toBeNull();

  mockWalletIssues[credentialKey] = { ...issue, credentialKey };
  rerender(renderWalletHeading());
  expect(screen.queryByText('Not backed up')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Wallet unavailable' }));
  });
  expect(mockDialog).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
});

it('coalesces recovery dialog requests and accepts a new request after close', async () => {
  render(<LocalSecretEnvelopeErrorDialogContainer />);
  const showDetails = () =>
    appEventBus.emit(
      EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
      issue,
    );
  await act(async () => {
    showDetails();
    showDetails();
  });
  expect(mockDialog).toHaveBeenCalledTimes(1);

  await act(async () => {
    await mockDialog.mock.calls[0][0].onClose?.();
    showDetails();
  });
  expect(mockDialog).toHaveBeenCalledTimes(2);
});

it('discards recovery UI requests when the container unmounts during loading', async () => {
  const { unmount } = render(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
    appEventBus.emit(
      EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
      issue,
    );
    appEventBus.emit(
      EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast,
      issue,
    );
    unmount();
  });
  expect(mockDialog).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it.each<[string, () => void]>([
  ['the app locks', () => jotaiDefaultStore.set(mockAppIsLockedAtom, true)],
  [
    'the app backgrounds',
    () => {
      AppState.currentState = 'background';
    },
  ],
])(
  'discards pending recovery UI when %s before React updates',
  async (_, changeState) => {
    render(<LocalSecretEnvelopeErrorDialogContainer />);
    await act(async () => {
      appEventBus.emit(
        EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
        issue,
      );
      appEventBus.emit(
        EAppEventBusNames.ShowLocalSecretEnvelopeRecoveryToast,
        issue,
      );
      changeState();
    });
    expect(mockDialog).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  },
);

it('shows the active-wallet badge only for the affected imported account', () => {
  const affectedAccountId = 'imported--60--0xabc';
  const credentialKey = getLocalSecretEnvelopeCredentialKey(
    'test-session',
    affectedAccountId,
  );
  mockWalletIssues[credentialKey] = { ...issue, credentialKey, imported: true };
  const renderActiveWalletBadge = (accountId: string) => (
    <WalletLocalSecretEnvelopeStatus
      credentialId={getActiveWalletLocalSecretEnvelopeCredentialId({
        ready: true,
        wallet: { id: 'imported' },
        dbAccount: { id: accountId },
      })}
      compact
    />
  );
  const { rerender } = render(renderActiveWalletBadge(affectedAccountId));
  expect(
    screen.queryByRole('button', { name: 'Wallet unavailable' }),
  ).not.toBeNull();

  rerender(renderActiveWalletBadge('imported--60--0xdef'));
  expect(
    screen.queryByRole('button', { name: 'Wallet unavailable' }),
  ).toBeNull();
});

it('ignores a preflight result after the selected wallet changes', async () => {
  jest.useFakeTimers();
  mockActiveWalletId = 'hd-1';
  const pending = Promise.withResolvers<ILocalSecretEnvelopeCredentialIssue>();
  mockPreflight.mockReturnValueOnce(pending.promise);
  const { rerender } = render(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(250);
  });
  mockActiveWalletId = 'hd-2';
  rerender(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
    pending.resolve(issue);
  });
  expect(mockToast).not.toHaveBeenCalled();
});

it('opens the recovery dialog when receive or copy address is guarded for an affected wallet', async () => {
  const credentialId = 'hd-5';
  const credentialKey = getLocalSecretEnvelopeCredentialKey(
    'test-session',
    credentialId,
  );
  mockWalletIssues[credentialKey] = { ...issue, credentialKey };

  render(<LocalSecretEnvelopeErrorDialogContainer />);
  let blocked = false;
  await act(async () => {
    blocked = await blockIfWalletLocalSecretEnvelopeUnavailable({
      walletId: credentialId,
      accountId: `${credentialId}--m/44'/60'/0'/0/0`,
    });
  });

  expect(blocked).toBe(true);
  expect(mockDialog).toHaveBeenCalledTimes(1);
  expect(mockDialog.mock.calls[0][0]).toMatchObject({
    title: 'Unable to access encrypted local data',
    onConfirmText: 'Import Wallet Again',
  });
});

it('uses a newly recorded issue when the on-demand preflight times out', async () => {
  jest.useFakeTimers();
  const credentialId = 'hd-5';
  const credentialKey = getLocalSecretEnvelopeCredentialKey(
    'test-session',
    credentialId,
  );
  const currentIssue = { ...issue, credentialKey };
  mockPreflight.mockReturnValueOnce(Promise.withResolvers<undefined>().promise);

  const result = getWalletLocalSecretEnvelopeUnavailableIssue({
    walletId: credentialId,
  });
  mockWalletIssues[credentialKey] = currentIssue;
  await jest.advanceTimersByTimeAsync(1500);
  expect(await result).toEqual(currentIssue);
});

it('shows recovery for a checked issue before foreground status catches up', () => {
  const credentialId = 'hd-5';
  const credentialKey = getLocalSecretEnvelopeCredentialKey(
    'test-session',
    credentialId,
  );
  const checkedIssue = { ...issue, credentialKey };
  render(
    <>
      <LocalSecretEnvelopeErrorDialogContainer />
      <WalletLocalSecretEnvelopeStatus
        credentialId={credentialId}
        issue={checkedIssue}
      />
    </>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Wallet unavailable' }));
  expect(mockDialog).toHaveBeenCalledTimes(1);
});
