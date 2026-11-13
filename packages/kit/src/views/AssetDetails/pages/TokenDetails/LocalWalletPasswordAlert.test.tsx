/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { ILocalWalletFrozenPart } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { LocalWalletPasswordAlert } from './LocalWalletPasswordAlert';

type IAccountParams = { networkId: string; accountId: string };
type IVerifyDialog = {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
};

const mockGetBalance = jest.fn<
  Promise<{ frozen: ILocalWalletFrozenPart[] }>,
  [IAccountParams]
>();
const mockVerify = jest.fn<Promise<void>, [IAccountParams]>();
const mockCloseDialog = jest.fn(async () => undefined);
const mockShowDialog = jest.fn((_params: IVerifyDialog) => ({
  close: mockCloseDialog,
  isExist: () => true,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { amount: string }) =>
      values?.amount ? `${id}: ${values.amount}` : id,
  }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: { getWithTimestamp: jest.fn(), set: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { RefreshTokenList: 'RefreshTokenList' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      getLocalWalletAccountBalance: (params: IAccountParams) =>
        mockGetBalance(params),
      verifyLocalWalletWithPassword: (params: IAccountParams) =>
        mockVerify(params),
    },
    serviceNetwork: {
      getNetwork: async () => ({ symbol: 'XMR' }),
    },
  },
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  const Stack = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    Icon: () => null,
    Dialog: { show: (params: IVerifyDialog) => mockShowDialog(params) },
    Button: ({
      children,
      testID,
      disabled,
      onPress,
    }: {
      children?: ReactNode;
      testID?: string;
      disabled?: boolean;
      onPress: () => Promise<void>;
    }) => (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={() => {
          void onPress();
        }}
      >
        {children}
      </button>
    ),
  };
});

const accountParams = { networkId: 'xmr--0', accountId: 'hd-1--0' };
const onVerified = jest.fn();

async function openDetailsDialog() {
  const view = render(
    <LocalWalletPasswordAlert
      {...accountParams}
      presentation="tokenDetails"
      onVerified={onVerified}
    />,
  );
  fireEvent.click(await screen.findByTestId('privacy-password-verify'));
  const dialog = mockShowDialog.mock.calls.at(-1)?.[0];
  if (!dialog)
    throw new OneKeyLocalError('Expected the verification explanation');
  return { dialog, ...view };
}

beforeEach(() => {
  mockGetBalance.mockReset().mockResolvedValue({
    frozen: [{ reason: 'needsPassword', amountParsed: '0.025' }],
  });
  mockVerify.mockReset().mockResolvedValue(undefined);
  mockShowDialog.mockClear();
  mockCloseDialog.mockClear();
  onVerified.mockClear();
});

it('explains the amount and does not authorize when the dialog is cancelled', async () => {
  const { dialog } = await openDetailsDialog();
  expect(dialog.title).toBe(ETranslations.privacy_balance_verification__title);
  expect(dialog.description).toBe(
    `${ETranslations.privacy_balance_verification__desc}: 0.025 XMR`,
  );
  expect(mockVerify).not.toHaveBeenCalled();

  await act(async () => dialog.onClose());

  expect(mockVerify).not.toHaveBeenCalled();
  expect(onVerified).not.toHaveBeenCalled();
  expect(screen.getByTestId('privacy-password-alert')).toBeTruthy();
});

it('authorizes after confirmation closes, refreshes, and hides only when no funds remain', async () => {
  const { dialog } = await openDetailsDialog();
  dialog.onConfirm();
  expect(mockVerify).not.toHaveBeenCalled();
  mockGetBalance.mockResolvedValue({ frozen: [] });

  await act(async () => dialog.onClose());

  expect(mockVerify).toHaveBeenCalledWith(accountParams);
  expect(onVerified).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.queryByTestId('privacy-password-alert')).toBeNull(),
  );
  expect(mockGetBalance).toHaveBeenCalledTimes(2);
});

it('keeps the entry and refreshed amount when some funds still need verification', async () => {
  const { dialog } = await openDetailsDialog();
  mockGetBalance.mockResolvedValue({
    frozen: [{ reason: 'needsPassword', amountParsed: '0.001' }],
  });

  await act(async () => {
    dialog.onConfirm();
    dialog.onClose();
  });
  fireEvent.click(screen.getByTestId('privacy-password-verify'));

  expect(mockShowDialog.mock.calls.at(-1)?.[0].description).toBe(
    `${ETranslations.privacy_balance_verification__desc}: 0.001 XMR`,
  );
  await act(async () => mockShowDialog.mock.calls.at(-1)?.[0].onClose());
});

it('keeps pending funds visible when authorization fails', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockVerify.mockRejectedValue(new Error('Verification failed'));
    const { dialog } = await openDetailsDialog();
    await act(async () => {
      dialog.onConfirm();
      dialog.onClose();
    });

    expect(onVerified).not.toHaveBeenCalled();
    expect(mockGetBalance).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('privacy-password-alert')).toBeTruthy();
    expect(
      screen.getByTestId('privacy-password-verify').hasAttribute('disabled'),
    ).toBe(false);
  } finally {
    errorLog.mockRestore();
  }
});

it('keeps the existing inline action direct for Home and Send', async () => {
  render(<LocalWalletPasswordAlert {...accountParams} />);
  const button = await screen.findByTestId('privacy-password-verify');
  await act(async () => fireEvent.click(button));

  expect(mockShowDialog).not.toHaveBeenCalled();
  expect(mockVerify).toHaveBeenCalledWith(accountParams);
});

it.each([
  { networkId: accountParams.networkId, accountId: 'hd-2--0' },
  { networkId: 'zec--0', accountId: accountParams.accountId },
])('closes the previous owner dialog after switching to %j', async (next) => {
  const { dialog, rerender } = await openDetailsDialog();
  rerender(
    <LocalWalletPasswordAlert
      {...next}
      presentation="tokenDetails"
      onVerified={onVerified}
    />,
  );

  expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  await act(async () => {
    dialog.onConfirm();
    dialog.onClose();
  });
  expect(mockVerify).not.toHaveBeenCalled();
  expect(onVerified).not.toHaveBeenCalled();
});

it('rejects a confirmed dialog if its owner changes before the close animation finishes', async () => {
  const { dialog, rerender } = await openDetailsDialog();
  dialog.onConfirm();
  rerender(
    <LocalWalletPasswordAlert
      networkId={accountParams.networkId}
      accountId="hd-2--0"
      presentation="tokenDetails"
    />,
  );

  await act(async () => dialog.onClose());

  expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  expect(mockVerify).not.toHaveBeenCalled();
});

it('closes the dialog on unmount and rejects its stale confirmation', async () => {
  const { dialog, unmount } = await openDetailsDialog();
  unmount();

  expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  await act(async () => {
    dialog.onConfirm();
    dialog.onClose();
  });
  expect(mockVerify).not.toHaveBeenCalled();
  expect(onVerified).not.toHaveBeenCalled();
});
