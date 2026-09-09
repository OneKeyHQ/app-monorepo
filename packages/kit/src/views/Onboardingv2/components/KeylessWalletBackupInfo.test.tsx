/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { useKeylessWalletExistsLocal } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnboardingTestIDs } from '../testIDs';

import { KeylessWalletBackupInfo } from './KeylessWalletBackupInfo';

const mockDialogShow = jest.fn();
const mockFormatMessage = jest.fn();

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
  Icon: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => <>{children}</>,
  XStack: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  ),
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock(
  '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet',
  () => ({
    useKeylessWalletExistsLocal: jest.fn(),
  }),
);

describe('KeylessWalletBackupInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = false;
    platformEnv.isDesktopMac = false;
    jest.mocked(useKeylessWalletExistsLocal).mockReturnValue(true);
  });

  it('does not render without a local Keyless wallet', () => {
    platformEnv.isNativeIOS = true;
    jest.mocked(useKeylessWalletExistsLocal).mockReturnValue(false);

    const { queryByTestId } = render(<KeylessWalletBackupInfo />);

    expect(
      queryByTestId(OnboardingTestIDs.iCloudBackupKeylessWalletHint),
    ).toBeNull();
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
      expect(mockFormatMessage).toHaveBeenCalledWith(
        { id: ETranslations.backup_keyless_no_cloud_google_desc },
        { provider },
      );
    },
  );
});
