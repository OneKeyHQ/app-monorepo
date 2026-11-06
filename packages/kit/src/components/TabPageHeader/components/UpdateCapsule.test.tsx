/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EUpdateErrorCode } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

import { UpdateCapsule } from './UpdateCapsule';

const mockDownloadPackage = jest.fn();
const mockCanDownload = jest.fn(async () => true);

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: ({
      children,
      onPress,
      testID,
      disabled,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
    }) => (
      <button data-testid={testID} onClick={onPress} disabled={disabled}>
        {children}
      </button>
    ),
    Icon: () => null,
    Spinner: () => null,
    Toast: { error: jest.fn() },
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    Tooltip: ({ renderTrigger }: { renderTrigger: ReactNode }) => renderTrigger,
    Popover: ({
      renderTrigger,
      renderContent,
    }: {
      renderTrigger: ReactNode;
      renderContent: ReactNode;
    }) => (
      <>
        {renderTrigger}
        {renderContent}
      </>
    ),
    useMedia: () => ({}),
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatNumber: String,
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAppUpdate: { canDownloadCurrentTarget: () => mockCanDownload() },
  },
}));
jest.mock('@onekeyhq/kit/src/components/AppUpdate', () => ({
  useDownloadPackage: () => ({
    downloadPackage: mockDownloadPackage,
    installPackage: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  useDownloadProgress: () => 0,
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('../../AppUpdate/AppUpdateForeground', () => ({
  peekDesktopUpdateBanner: () => undefined,
  startDesktopUpdateBanner: () => undefined,
}));
jest.mock('./UpdateVerifyReceipt', () => ({ UpdateVerifyReceipt: () => null }));

beforeAll(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
});

test.each([
  EAppUpdateStatus.downloadPackageFailed,
  EAppUpdateStatus.downloadASCFailed,
  EAppUpdateStatus.verifyASCFailed,
  EAppUpdateStatus.verifyPackageFailed,
])('retryable %s exposes a working retry', async (status) => {
  mockDownloadPackage.mockClear();
  const view = render(
    <UpdateCapsule
      showUpdate
      onWhatsNew={() => {}}
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status,
        updateError: { code: EUpdateErrorCode.networkError, step: 'download' },
      }}
    />,
  );
  await act(async () => {
    fireEvent.click(view.getByTestId('header-update-retry'));
  });
  expect(mockDownloadPackage).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  'integrity failure retains safe download recovery without claiming a locked file was removed (retained=%s)',
  (retained) => {
    const view = render(
      <UpdateCapsule
        showUpdate
        onWhatsNew={() => {}}
        data={{
          latestVersion: '2.0.0',
          updateAt: 0,
          updateStrategy: EUpdateStrategy.manual,
          status: EAppUpdateStatus.verifyPackageFailed,
          updateError: {
            code: EUpdateErrorCode.integrityFailed,
            step: 'verifyPackage',
          },
          downloadedEvent: retained
            ? {
                latestVersion: '2.0.0',
                downloadUrl: 'https://cdn.onekey.so/app.exe',
              }
            : undefined,
        }}
      />,
    );
    expect(view.getByTestId('header-update-github')).toBeTruthy();
    expect(view.queryByTestId('header-update-retry')).toBeNull();
    expect(
      view.queryByText(ETranslations.app_update_file_removed__desc),
    ).toBeNull();
    expect(
      view.getByText(ETranslations.app_update_cant_continue__msg),
    ).toBeTruthy();
  },
);
