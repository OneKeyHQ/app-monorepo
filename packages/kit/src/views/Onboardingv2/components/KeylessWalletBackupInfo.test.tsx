/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { useKeylessWalletExistsLocal } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnboardingTestIDs } from '../testIDs';

import { KeylessWalletBackupInfo } from './KeylessWalletBackupInfo';

const mockDialogShow = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockDialogClose = jest.fn(async () => {});
const mockExportBackupArchive = jest.fn(async (_options: unknown) => ({
  archiveBase64: 'UEsDBA==',
  password: 'random-zip-password',
}));
const mockDownloadAsFile = jest.fn(async (_options: unknown) => {});
const mockPasswordDialogClose = jest.fn(async () => {});
const mockPasswordDialogExists = jest.fn(() => true);
const mockPasswordDialogShow = jest.fn<
  void,
  [{ onSubmit: (password: string) => Promise<void> }]
>();
const mockCopyText = jest.fn();
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
  useClipboard: () => ({ copyText: mockCopyText }),
  Toast: {
    success: (options: unknown) => {
      mockToastSuccess(options);
    },
    error: (options: unknown) => {
      mockToastError(options);
    },
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
      exportBackupArchive: (options: unknown) =>
        mockExportBackupArchive(options),
    },
  },
}));

jest.mock('../../../utils/downloadAsFile', () => ({
  downloadAsFile: (options: unknown) => mockDownloadAsFile(options),
}));

jest.mock('./CloudBackupDialogs', () => ({
  showCloudBackupPasswordDialog: (options: {
    onSubmit: (password: string) => Promise<void>;
  }) => {
    mockPasswordDialogShow(options);
    return {
      close: mockPasswordDialogClose,
      isExist: mockPasswordDialogExists,
    };
  },
}));

describe('KeylessWalletBackupInfo', () => {
  function openDownloadDialog() {
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
    return dialog;
  }

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

  async function startExport() {
    const dialog = openDownloadDialog();
    fireEvent.click(
      dialog.getByTestId(OnboardingTestIDs.iCloudBackupDevDownloadDataBtn),
    );
    await waitFor(() =>
      expect(mockPasswordDialogShow).toHaveBeenCalledTimes(1),
    );
    return mockPasswordDialogShow.mock.calls[0][0].onSubmit;
  }

  it.each(['Android', 'iOS', 'macOS'])(
    'downloads a ZIP and offers its extraction password on %s',
    async (platform) => {
      platformEnv.isNativeAndroid = platform === 'Android';
      platformEnv.isNativeIOS = platform === 'iOS';
      platformEnv.isDesktopMac = platform === 'macOS';
      platformEnv.isNative = platform !== 'macOS';
      const submit = await startExport();
      expect(mockExportBackupArchive).not.toHaveBeenCalled();
      await act(async () => submit('original-backup-password'));
      expect(mockExportBackupArchive).toHaveBeenCalledWith({
        recordId: 'backup-id',
        password: 'original-backup-password',
      });
      expect(mockDownloadAsFile).toHaveBeenCalledWith({
        content: 'UEsDBA==',
        filename: expect.stringMatching(/^onekey-cloud-backup-\d+\.zip$/),
        encoding: 'base64',
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
      });
      const options: IDialogShowProps = mockDialogShow.mock.calls[1][0];
      expect(options.title).toBe('ZIP extraction password');
      const result = render(<>{options.renderContent}</>);
      expect(result.getByText('random-zip-password')).toBeTruthy();
      expect(mockCopyText).not.toHaveBeenCalled();
      fireEvent.click(result.getByTestId('cloud-backup-copy-zip-password'));
      expect(mockCopyText).toHaveBeenCalledWith('random-zip-password');
      expect(mockToastSuccess).not.toHaveBeenCalled();
    },
  );

  it('dismisses both dialogs before sharing and waits for sharing before showing the password', async () => {
    platformEnv.isNativeIOS = true;
    platformEnv.isNative = true;
    let finishExplanationClose: (() => void) | undefined;
    mockDialogClose.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishExplanationClose = resolve;
        }),
    );
    const started = startExport();
    expect(mockPasswordDialogShow).not.toHaveBeenCalled();
    await act(async () => {
      finishExplanationClose?.();
    });
    const submit = await started;
    let finishPasswordClose: (() => void) | undefined;
    let finishSharing: (() => void) | undefined;
    mockPasswordDialogClose.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPasswordClose = resolve;
        }),
    );
    mockDownloadAsFile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSharing = resolve;
        }),
    );
    const submitted = submit('original-backup-password');
    await waitFor(() =>
      expect(mockPasswordDialogClose).toHaveBeenCalledTimes(1),
    );
    expect(mockDownloadAsFile).not.toHaveBeenCalled();
    await act(async () => {
      finishPasswordClose?.();
    });
    await waitFor(() => expect(mockDownloadAsFile).toHaveBeenCalledTimes(1));
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishSharing?.();
      await submitted;
    });
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
  });

  it('keeps the password prompt open on a wrong backup password', async () => {
    platformEnv.isNativeAndroid = true;
    const submit = await startExport();
    mockExportBackupArchive.mockRejectedValueOnce(
      new Error('Incorrect password'),
    );
    await expect(submit('wrong-password')).rejects.toThrow(
      'Incorrect password',
    );
    expect(mockPasswordDialogClose).not.toHaveBeenCalled();
    expect(mockDownloadAsFile).not.toHaveBeenCalled();
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  it('does not share if the password prompt was dismissed while preparing the ZIP', async () => {
    platformEnv.isNativeAndroid = true;
    const submit = await startExport();
    mockPasswordDialogExists.mockReturnValueOnce(false);
    await submit('original-backup-password');
    expect(mockDownloadAsFile).not.toHaveBeenCalled();
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  it('does not show the result dialog when saving or sharing fails', async () => {
    platformEnv.isNativeIOS = true;
    const submit = await startExport();
    mockDownloadAsFile.mockRejectedValueOnce(new Error('Share failed'));
    await expect(submit('original-backup-password')).rejects.toThrow(
      'Share failed',
    );
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });
});
