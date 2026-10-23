/** @jest-environment jsdom */
import type { ComponentProps, PropsWithChildren } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import type { IBackupProviderAccountInfo } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import {
  OAuthLoginCancelError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { OnboardingTestIDs } from '../testIDs';

import ICloudBackupDetails from './ICloudBackupDetails';

const mockPrepareBackup = jest.fn<
  Promise<IPrimeTransferData | undefined>,
  []
>();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: true, isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: jest.fn(async () => undefined) },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual(
    '../../../../../components/src/hooks/useDeferredPromise',
  ) as typeof import('../../../../../components/src/hooks/useDeferredPromise');
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Button: ({
      children,
      onPress,
      disabled,
      testID,
    }: PropsWithChildren<{
      onPress?: () => Promise<void> | void;
      disabled?: boolean;
      testID?: string;
    }>) => (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={() => onPress?.()}
      >
        {children}
      </button>
    ),
    Icon: () => null,
    SizableText: Container,
    XStack: Container,
    YStack: Container,
    Dialog: { confirm: jest.fn() },
    Toast: { error: jest.fn(), success: jest.fn() },
    useMedia: () => ({ gtMd: true }),
    useSafeAreaInsets: () => ({ bottom: 0 }),
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceCloudBackupV2: { getCloudAccountInfo: jest.fn() } },
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: jest.fn() }),
}));
jest.mock('../hooks/useCloudBackup', () => ({
  useCloudBackup: () => ({
    prepareBackup: mockPrepareBackup,
    checkLoading: false,
  }),
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));
jest.mock('../../../components/MultipleClickStack', () => ({
  MultipleClickStack: () => null,
}));
jest.mock('../components/CloudBackupDialogs', () => ({
  showCloudBackupPasswordDialog: jest.fn(),
}));
jest.mock('../components/CloudBackupEmptyView', () => ({
  CloudBackupDetailsEmptyView: () => <div>Empty backup</div>,
}));
jest.mock('../components/CloudBackupLoadingSkeleton', () => ({
  CloudBackupLoadingSkeleton: () => <div>Preparing backup</div>,
}));
jest.mock('../components/KeylessWalletBackupInfo', () => ({
  KeylessWalletBackupInfo: () => null,
}));
jest.mock('../components/Layout', () => ({
  OnboardingPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

const data: IPrimeTransferData = {
  privateData: {
    credentials: {},
    wallets: {},
    importedAccounts: {},
    watchingAccounts: {},
  },
  publicData: {
    dataTime: 1,
    totalWalletsCount: 1,
    totalAccountsCount: 1,
    walletDetails: [
      {
        name: 'Synthetic wallet',
        avatar: 'bear',
        accountsCount: 1,
        walletXfp: undefined,
      },
    ],
  },
  appVersion: 'test',
  isEmptyData: false,
  isWatchingOnly: false,
};
const signedOut: IBackupProviderAccountInfo = {
  userId: '',
  userEmail: '',
  providerType: ECloudBackupProviderType.GoogleDrive,
  googleDrive: { googlePlayServiceAvailable: true, userInfo: null },
};
const signedIn: IBackupProviderAccountInfo = {
  userId: 'synthetic-id',
  userEmail: 'synthetic@example.invalid',
  providerType: ECloudBackupProviderType.GoogleDrive,
  googleDrive: {
    googlePlayServiceAvailable: true,
    userInfo: {
      user: {
        id: 'synthetic-id',
        email: 'synthetic@example.invalid',
        name: null,
        photo: null,
        familyName: null,
        givenName: null,
      },
      idToken: null,
      serverAuthCode: null,
    },
  },
};
const getAccountInfo = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method -- The service method is replaced by a Jest mock.
  backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo,
);
const props = { route: { params: { actionType: 'backup' } } } as ComponentProps<
  typeof ICloudBackupDetails
>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockPrepareBackup.mockReset();
  getAccountInfo.mockReset();
  getAccountInfo.mockResolvedValue(signedOut);
  jest
    .spyOn(errorToastUtils, 'showToastOfError')
    .mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('refreshes the mounted account bar after first authorization and enables backup', async () => {
  const authorization = deferred<IPrimeTransferData>();
  mockPrepareBackup.mockReturnValueOnce(authorization.promise);
  render(<ICloudBackupDetails {...props} />);
  await screen.findByText(ETranslations.google_account_not_signed_in);
  await waitFor(() => expect(mockPrepareBackup).toHaveBeenCalledTimes(1));
  getAccountInfo.mockResolvedValue(signedIn);
  await act(async () => authorization.resolve(data));
  await screen.findByText('synthetic@example.invalid');
  expect(screen.getByText(ETranslations.global_logout)).toBeTruthy();
  expect(
    screen.queryByText(ETranslations.google_account_not_signed_in),
  ).toBeNull();
  expect(
    (
      screen.getByTestId(
        OnboardingTestIDs.iCloudBackupDetailsBackupNowBtn,
      ) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(getAccountInfo).toHaveBeenCalledTimes(2);
});

it('settles initial cancel and retry cancel without an unhandled rejection, then retries successfully', async () => {
  mockPrepareBackup
    .mockRejectedValueOnce(new OAuthLoginCancelError())
    .mockRejectedValueOnce(new OAuthLoginCancelError())
    .mockImplementationOnce(async () => {
      getAccountInfo.mockResolvedValue(signedIn);
      return data;
    });
  render(<ICloudBackupDetails {...props} />);
  fireEvent.click(
    await screen.findByTestId(OnboardingTestIDs.iCloudBackupDetailsRetryBtn),
  );
  await waitFor(() => expect(mockPrepareBackup).toHaveBeenCalledTimes(2));
  expect(
    await screen.findByTestId(OnboardingTestIDs.iCloudBackupDetailsRetryBtn),
  ).toBeTruthy();
  expect(screen.queryByText('Preparing backup')).toBeNull();
  expect(errorToastUtils.showToastOfError).not.toHaveBeenCalled();
  expect(getAccountInfo).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByTestId(OnboardingTestIDs.iCloudBackupDetailsRetryBtn),
  );
  await screen.findByText('synthetic@example.invalid');
  expect(screen.getByText(ETranslations.global_logout)).toBeTruthy();
  expect(mockPrepareBackup).toHaveBeenCalledTimes(3);
  expect(
    screen.queryByTestId(OnboardingTestIDs.iCloudBackupDetailsRetryBtn),
  ).toBeNull();
});

it.each(['permission denied', 'network failure'])(
  'handles %s with feedback and a working retry',
  async (message) => {
    const error = new OneKeyLocalError(message);
    mockPrepareBackup.mockRejectedValueOnce(error).mockResolvedValueOnce(data);
    render(<ICloudBackupDetails {...props} />);
    const retry = await screen.findByTestId(
      OnboardingTestIDs.iCloudBackupDetailsRetryBtn,
    );
    expect(errorToastUtils.showToastOfError).toHaveBeenCalledWith(error);
    fireEvent.click(retry);
    await screen.findByText('Synthetic wallet');
    expect(
      screen.queryByTestId(OnboardingTestIDs.iCloudBackupDetailsRetryBtn),
    ).toBeNull();
  },
);

it.each(['success', 'cancel', 'error'] as const)(
  'ignores late %s after leaving the page',
  async (outcome) => {
    const authorization = deferred<IPrimeTransferData>();
    mockPrepareBackup.mockReturnValueOnce(authorization.promise);
    const page = render(<ICloudBackupDetails {...props} />);
    await waitFor(() => expect(mockPrepareBackup).toHaveBeenCalledTimes(1));
    page.unmount();
    await act(async () => {
      if (outcome === 'success') authorization.resolve(data);
      else
        authorization.reject(
          outcome === 'cancel'
            ? new OAuthLoginCancelError()
            : new OneKeyLocalError('failed after exit'),
        );
    });
    expect(getAccountInfo).toHaveBeenCalledTimes(1);
    expect(errorToastUtils.showToastOfError).not.toHaveBeenCalled();
  },
);
