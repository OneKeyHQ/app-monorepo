/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { useKeylessWalletExistsLocal } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnboardingTestIDs } from '../testIDs';

import { KeylessWalletBackupInfo } from './KeylessWalletBackupInfo';

const mockDialogShow = jest.fn();
const mockToastSuccess = jest.fn();
const mockDialogClose = jest.fn(async () => {});
const mockDownload = jest.fn(async (_options: unknown) => ({
  content: 'encrypted backup',
}));
const mockDownloadAsFile = jest.fn(async (_options: unknown) => {});
const mockFormatMessage = jest.fn();
let mockDevSettingsEnabled = true;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (...args: unknown[]) => {
      mockFormatMessage(...args);
      return 'translated message';
    },
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (options: unknown) => {
      mockDialogShow(options);
    },
  },
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  Stack: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  useDialogInstance: () => ({ close: mockDialogClose }),
  Toast: {
    success: (options: unknown) => {
      mockToastSuccess(options);
    },
    error: jest.fn(),
  },
  Icon: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => <>{children}</>,
  XStack: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  YStack: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    ),
}));

jest.mock(
  '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet',
  () => ({
    useKeylessWalletExistsLocal: jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: mockDevSettingsEnabled }],
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceCloudBackupV2: {
      download: (options: unknown) => mockDownload(options),
    },
  },
}));

jest.mock('../../../utils/downloadAsFile', () => ({
  downloadAsFile: (options: unknown) => mockDownloadAsFile(options),
}));

describe('KeylessWalletBackupInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNative = false;
    platformEnv.isDev = true;
    mockDevSettingsEnabled = true;
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = false;
    platformEnv.isDesktopMac = false;
    jest.mocked(useKeylessWalletExistsLocal).mockReturnValue(true);
  });

  it('renders without a local Keyless wallet', () => {
    platformEnv.isNativeIOS = true;
    jest.mocked(useKeylessWalletExistsLocal).mockReturnValue(false);

    const { queryByTestId } = render(<KeylessWalletBackupInfo />);

    expect(
      queryByTestId(OnboardingTestIDs.iCloudBackupKeylessWalletHint),
    ).not.toBeNull();
  });

  it('does not render on platforms without cloud backup support', () => {
    const { queryByTestId } = render(<KeylessWalletBackupInfo />);

    expect(
      queryByTestId(OnboardingTestIDs.iCloudBackupKeylessWalletHint),
    ).toBeNull();
  });

  it.each([
    {
      platform: 'Android',
      isAndroid: true,
      isIOS: false,
      isMac: false,
      provider: 'Google Drive',
    },
    {
      platform: 'iOS',
      isAndroid: false,
      isIOS: true,
      isMac: false,
      provider: 'iCloud',
    },
    {
      platform: 'macOS',
      isAndroid: false,
      isIOS: false,
      isMac: true,
      provider: 'iCloud',
    },
  ])(
    'uses the complete cloud provider name on $platform',
    ({ isAndroid, isIOS, isMac, provider }) => {
      platformEnv.isNativeAndroid = isAndroid;
      platformEnv.isNativeIOS = isIOS;
      platformEnv.isDesktopMac = isMac;
      const { getByTestId } = render(<KeylessWalletBackupInfo />);

      fireEvent.click(
        getByTestId(OnboardingTestIDs.iCloudBackupKeylessWalletHint),
      );

      expect(mockDialogShow).toHaveBeenCalledTimes(1);
      const options: { renderContent: ReactNode } =
        mockDialogShow.mock.calls[0][0];
      render(<>{options.renderContent}</>);
      expect(mockFormatMessage).toHaveBeenCalledWith(
        { id: ETranslations.backup_keyless_no_cloud_google_desc },
        { provider },
      );
    },
  );

  it.each([
    { isDev: true, enabled: true, backupRecordId: 'backup-id', visible: true },
    {
      isDev: false,
      enabled: true,
      backupRecordId: 'backup-id',
      visible: true,
    },
    {
      isDev: true,
      enabled: false,
      backupRecordId: 'backup-id',
      visible: false,
    },
    { isDev: true, enabled: true, backupRecordId: undefined, visible: false },
  ])(
    'reveals the download inside the dialog with $isDev/$enabled/$backupRecordId',
    ({ isDev, enabled, backupRecordId, visible }) => {
      platformEnv.isNativeIOS = true;
      platformEnv.isDev = isDev;
      mockDevSettingsEnabled = enabled;
      const page = render(
        <KeylessWalletBackupInfo backupRecordId={backupRecordId} />,
      );
      fireEvent.click(
        page.getByTestId(OnboardingTestIDs.iCloudBackupKeylessWalletHint),
      );
      const options: { renderContent: ReactNode } =
        mockDialogShow.mock.calls[0][0];
      const dialog = render(<>{options.renderContent}</>);
      const title = dialog.getByTestId(
        OnboardingTestIDs.iCloudBackupKeylessWalletDialogTitle,
      );
      const buttonId = OnboardingTestIDs.iCloudBackupDevDownloadDataBtn;
      expect(dialog.queryByTestId(buttonId)).toBeNull();
      const triggerAt = isDev ? 3 : 10;
      for (let index = 0; index < triggerAt - 1; index += 1) {
        fireEvent.click(title);
      }
      expect(dialog.queryByTestId(buttonId)).toBeNull();
      fireEvent.click(title);
      expect(
        Boolean(dialog.container.querySelector(`[data-testid="${buttonId}"]`)),
      ).toBe(visible);
      expect(
        page.container.querySelector(`[data-testid="${buttonId}"]`),
      ).toBeNull();
    },
  );

  it('waits for dialog dismissal before sharing and does not report dismissal as success', async () => {
    platformEnv.isNativeIOS = true;
    platformEnv.isNative = true;
    let finishClose: (() => void) | undefined;
    mockDialogClose.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    const page = render(<KeylessWalletBackupInfo backupRecordId="backup-id" />);
    fireEvent.click(
      page.getByTestId(OnboardingTestIDs.iCloudBackupKeylessWalletHint),
    );
    const options: { renderContent: ReactNode } =
      mockDialogShow.mock.calls[0][0];
    const dialog = render(<>{options.renderContent}</>);
    const title = dialog.getByTestId(
      OnboardingTestIDs.iCloudBackupKeylessWalletDialogTitle,
    );
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(title);
    }
    fireEvent.click(
      dialog.getByTestId(OnboardingTestIDs.iCloudBackupDevDownloadDataBtn),
    );
    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockDownloadAsFile).not.toHaveBeenCalled();
    await act(async () => {
      finishClose?.();
    });
    await waitFor(() =>
      expect(mockDownloadAsFile).toHaveBeenCalledWith({
        content: 'encrypted backup',
        filename: 'onekey-cloud-backup-backup-id.json',
      }),
    );
    expect(mockDownload).toHaveBeenCalledWith({ recordId: 'backup-id' });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
