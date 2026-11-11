/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletBoundReferralCodeButton } from './WalletBoundReferralCodeButton';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const { runAfterActionListClose } = jest.requireActual<
    typeof import('../../../../../../components/src/actions/ActionList/runAfterClose')
  >('../../../../../../components/src/actions/ActionList/runAfterClose');
  return {
    runAfterActionListClose,
    ActionList: {
      Item: ({
        onPress,
        onClose,
        disabled,
      }: {
        onPress: (close: () => void | Promise<void>) => Promise<void>;
        onClose: () => void | Promise<void>;
        disabled: boolean;
      }) => (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            void onPress(onClose);
          }}
        >
          Invite code
        </button>
      ),
      SkeletonItem: () => null,
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus', () => ({
  useBotWalletDeactivatedStatus: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: { displayStatus: 'bind', shouldBound: true },
    run: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/utils/botWalletDisabledToast', () => ({
  showBotWalletDisabledToast: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode',
  () => ({
    useWalletBoundReferralCode: () => ({
      getReferralCodeBindDisplayStatus: jest.fn(),
    }),
  }),
);

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHdWallet: () => true,
  },
}));

const wallet = { id: 'hd-test', name: 'Test wallet' } as IDBWallet;
const wasNative = platformEnv.isNative;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  platformEnv.isNative = false;
  jest.mocked(useBotWalletDeactivatedStatus).mockReturnValue({
    isBotWallet: false,
    isBotWalletDeactivated: false,
  });
});

afterEach(() => {
  jest.useRealTimers();
  platformEnv.isNative = wasNative;
});

it('waits for the web menu exit before opening once after duplicate taps', async () => {
  const close = jest.fn();
  const openDialog = jest.fn();
  render(
    <WalletBoundReferralCodeButton
      wallet={wallet}
      onClose={close}
      bindWalletInviteCode={openDialog}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(openDialog).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(149);
  });
  expect(openDialog).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(openDialog).toHaveBeenCalledTimes(1);
  expect(openDialog).toHaveBeenCalledWith({
    wallet,
    onSuccess: expect.any(Function),
  });
});

it('waits for native dismissal and uses the source page callback after menu unmount', async () => {
  platformEnv.isNative = true;
  let finishClose: (() => void) | undefined;
  const close = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finishClose = resolve;
      }),
  );
  const openDialog = jest.fn();
  const { unmount } = render(
    <WalletBoundReferralCodeButton
      wallet={wallet}
      onClose={close}
      bindWalletInviteCode={openDialog}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    jest.advanceTimersByTime(1000);
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(openDialog).not.toHaveBeenCalled();

  unmount();
  await act(async () => {
    finishClose?.();
  });
  expect(openDialog).toHaveBeenCalledTimes(1);
  expect(openDialog).toHaveBeenCalledWith({
    wallet,
    onSuccess: expect.any(Function),
  });
});

it('skips a canceled dismissal and allows a later tap to retry', async () => {
  const { OverlayCloseCancelledError } = jest.requireActual<
    typeof import('../../../../../../components/src/shared/overlayCloseCancellation')
  >('../../../../../../components/src/shared/overlayCloseCancellation');
  platformEnv.isNative = true;
  const close = jest
    .fn()
    .mockRejectedValueOnce(new OverlayCloseCancelledError('reopened'))
    .mockResolvedValue(undefined);
  const openDialog = jest.fn();
  render(
    <WalletBoundReferralCodeButton
      wallet={wallet}
      onClose={close}
      bindWalletInviteCode={openDialog}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  expect(openDialog).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  expect(close).toHaveBeenCalledTimes(2);
  expect(openDialog).toHaveBeenCalledTimes(1);
});

it('closes the menu before showing the deactivated bot wallet toast', async () => {
  jest.mocked(useBotWalletDeactivatedStatus).mockReturnValue({
    isBotWallet: true,
    isBotWalletDeactivated: true,
  });
  const close = jest.fn();
  const openDialog = jest.fn();
  render(
    <WalletBoundReferralCodeButton
      wallet={wallet}
      onClose={close}
      bindWalletInviteCode={openDialog}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(showBotWalletDisabledToast).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(150);
  });
  expect(showBotWalletDisabledToast).toHaveBeenCalledWith('referral');
  expect(openDialog).not.toHaveBeenCalled();
});
