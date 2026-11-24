/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IDialogShowProps, IToastProps } from '@onekeyhq/components';
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

import { WalletLocalSecretEnvelopeStatus } from '../../../components/AccountSelector/WalletLocalSecretEnvelopeStatus';

import { LocalSecretEnvelopeErrorDialogContainer } from './LocalSecretEnvelopeErrorDialogContainer';

const mockToast = jest.fn((_props: IToastProps) => undefined);
const mockDialog = jest.fn((_props: IDialogShowProps) => undefined);
const mockNavigate = jest.fn<void, unknown[]>();
const mockPreflight = jest.fn<
  Promise<ILocalSecretEnvelopeCredentialIssue | undefined>,
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
  mockActiveWalletId = undefined;
  mockWalletIssues = {};
});

afterEach(() => {
  jest.useRealTimers();
});

it('deduplicates toast events and opens the wallet import options on demand', async () => {
  render(<LocalSecretEnvelopeErrorDialogContainer />);
  await act(async () => {
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
  expect(mockToast.mock.calls[0][0].message).toBe('Device key missing');
  expect(mockDialog).not.toHaveBeenCalled();
  const actions = mockToast.mock.calls[0][0].actions;
  const action = Array.isArray(actions) ? actions[0] : actions;
  expect(action?.label).toBe(ETranslations.global_details);
  await act(async () => {
    await action?.onPress?.();
  });
  expect(mockDialog).toHaveBeenCalledTimes(1);
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
    params: { screen: EOnboardingPagesV2.CreateOrImportWallet },
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
  expect(mockToast.mock.calls[0][0].message).toBe(
    'Wallet envelope authentication failed',
  );
  expect(mockDialog).not.toHaveBeenCalled();
});

it('replaces backup guidance with the recovery action for a wallet with a confirmed issue', () => {
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
  fireEvent.click(screen.getByRole('button', { name: 'Wallet unavailable' }));
  expect(mockDialog).toHaveBeenCalledTimes(1);
  expect(mockToast).not.toHaveBeenCalled();
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
