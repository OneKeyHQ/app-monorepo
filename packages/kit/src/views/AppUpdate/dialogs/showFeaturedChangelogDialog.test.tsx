/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IDialogContainerProps } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import { markPendingContactSupportHandoff } from '../hooks/useForceUpdateContactSupport';

import { showFeaturedChangelogDialog } from './showFeaturedChangelogDialog';

const mockClose = jest.fn<Promise<void>, []>();
const mockRelease = jest.fn();
const mockPushModal = jest.fn();
const mockOpenSupport = jest.fn(async () => {});
const mockWaitForDownloadPage = jest.fn<Promise<boolean>, [string]>();
const mockDownloadPackage = jest.fn();
let mockAcceptHandoff: (accepted: boolean) => void = () => {};
const mockWaitForHandoff = jest.fn(
  () =>
    new Promise<boolean>((resolve) => {
      mockAcceptHandoff = resolve;
    }),
);
let mockNative = false;
let mockContainerProps: IDialogContainerProps;
const mockUpdateInfo = {
  latestVersion: '99.0.0',
  updateStrategy: 1,
  status: 'notify',
  downloadUrl: 'https://example.com/update',
  featuredChangelog: { features: [{ title: 'Test update' }] },
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Dialog: { show: jest.fn() },
    DialogContainer: React.forwardRef(
      ({ renderContent, ...props }: IDialogContainerProps, _ref) => {
        mockContainerProps = props;
        return <>{renderContent}</>;
      },
    ),
    Toast: { success: jest.fn() },
    acquireDeferredGuideBlocker: () => mockRelease,
  };
});
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  appUpdatePersistAtom: { atom: () => 'test-update' },
  useAppUpdatePersistAtom: () => [mockUpdateInfo],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore', () => ({
  jotaiDefaultStore: { get: () => mockUpdateInfo },
}));
jest.mock('@onekeyhq/shared/src/appUpdate', () => ({
  EAppUpdateStatus: { notify: 'notify' },
  EUpdateStrategy: { force: 1 },
  EUpdateFileType: { appShell: 1 },
  getUpdateFileType: () => 1,
  isAllowedFeaturedHref: () => false,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { appUpdate: { whatsNewClosed: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockNative;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  parseNotificationPayload: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceAppUpdate: { fetchAppUpdateInfo: jest.fn() } },
}));
jest.mock('../../../components/AppUpdate/useDownloadPackage', () => ({
  useDownloadPackage: () => ({ downloadPackage: mockDownloadPackage }),
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('../../../routes/config/deeplink', () => ({
  handleDeepLinkUrl: jest.fn(),
}));
jest.mock('../components/FeaturedCarousel', () => ({
  FeaturedCarousel: () => null,
}));
jest.mock('../components/FeaturedFooter', () => ({
  FeaturedFooter: ({
    onContactSupportPress,
    onCtaPress,
  }: {
    onContactSupportPress: () => void;
    onCtaPress: () => void;
  }) => (
    <>
      <button onClick={onContactSupportPress}>Contact support</button>
      <button onClick={onCtaPress}>Download and verify</button>
    </>
  ),
}));
jest.mock('../hooks/useForceUpdateContactSupport', () => ({
  markPendingContactSupportHandoff: jest.fn(),
  waitForContactSupportHandoff: () => mockWaitForHandoff(),
  waitForFeaturedDownloadPage: (id: string) => mockWaitForDownloadPage(id),
  useForceUpdateContactSupport: () => ({
    updateInfo: mockUpdateInfo,
    isForceUpdate: true,
    handleContactSupport: mockOpenSupport,
  }),
}));

describe.each([false, true])(
  'featured update support with native=%s',
  (native) => {
    beforeEach(() => {
      mockNative = native;
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.mocked(Dialog.show).mockReturnValue({
        close: mockClose,
        isExist: () => true,
        getForm: () => undefined,
      });
    });
    afterEach(() => jest.useRealTimers());

    function renderFeaturedDialog() {
      showFeaturedChangelogDialog({ isPreInstall: true });
      const props = jest.mocked(Dialog.show).mock.calls[0][0];
      const container = props.dialogContainer?.({ ref: { current: null } });
      render(<>{container}</>);
      return props;
    }

    it('keeps the dialog until the download page commits', async () => {
      let commitDownload: (mounted: boolean) => void = () => {};
      mockWaitForDownloadPage.mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          commitDownload = resolve;
        }),
      );
      const props = renderFeaturedDialog();
      expect(await props.onBeforeClose?.()).toBe(false);

      fireEvent.click(
        screen.getByRole('button', { name: 'Download and verify' }),
      );
      const [downloadHandoffId] = mockWaitForDownloadPage.mock.calls[0];
      expect(mockDownloadPackage).toHaveBeenCalledTimes(1);
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.DownloadVerify,
        params: { isForceUpdate: true, downloadHandoffId },
      });
      await act(async () => jest.advanceTimersByTimeAsync(300));
      expect(mockClose).not.toHaveBeenCalled();
      expect(await props.onBeforeClose?.()).toBe(false);

      await act(async () => commitDownload(true));
      expect(mockClose).toHaveBeenCalledWith({ flag: 'programmatic' });
    });

    it('retains the dialog and allows retry when no download page takes over', async () => {
      mockWaitForDownloadPage.mockResolvedValueOnce(false);
      const props = renderFeaturedDialog();
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Download and verify' }),
        );
      });
      expect(mockClose).not.toHaveBeenCalled();
      expect(await props.onBeforeClose?.()).toBe(false);
      mockWaitForDownloadPage.mockResolvedValueOnce(true);
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Download and verify' }),
        );
      });
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('waits for UpdatePreview to mount and the dialog to exit before opening support', async () => {
      let finishClose: () => void = () => {};
      mockClose.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishClose = resolve;
          }),
      );
      const props = renderFeaturedDialog();
      expect(mockContainerProps.dismissOnOverlayPress).toBe(false);
      expect(mockContainerProps.disableSystemClose).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Contact support' }));
      expect(markPendingContactSupportHandoff).toHaveBeenCalledTimes(1);
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.UpdatePreview,
        params: { latestVersion: '99.0.0', isForceUpdate: true },
      });
      expect(mockClose).not.toHaveBeenCalled();
      expect(mockOpenSupport).not.toHaveBeenCalled();
      await act(async () => mockAcceptHandoff(true));
      expect(mockClose).toHaveBeenCalledWith({ flag: 'programmatic' });
      expect(mockOpenSupport).not.toHaveBeenCalled();
      await act(async () => finishClose());
      expect(mockRelease).toHaveBeenCalledTimes(1);
      expect(mockOpenSupport).toHaveBeenCalledTimes(1);
      expect(await props.onBeforeClose?.({ flag: 'programmatic' })).toBe(true);
    });
  },
);
