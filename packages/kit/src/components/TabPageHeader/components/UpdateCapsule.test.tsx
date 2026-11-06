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
const mockDownloadASC = jest.fn();
const mockVerifyASC = jest.fn();
const mockCanDownload = jest.fn(async () => true);
const mockCanRestart = jest.fn(async () => true);
const mockStartBanner = jest.fn();
let mockRouteFocused = true;
let mockBanner: { version: string; expiresAt?: number } | undefined;

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    id,
  }: {
    children?: ReactNode;
    id?: string;
  }) => <div id={id}>{children}</div>;
  return {
    Button: ({
      children,
      onPress,
      testID,
      disabled,
      id,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
      id?: string;
    }) => (
      <button
        id={id}
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
      >
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
    serviceAppUpdate: {
      canDownloadCurrentTarget: () => mockCanDownload(),
      canRestartForUpdate: () => mockCanRestart(),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/AppUpdate', () => ({
  useDownloadPackage: () => ({
    downloadPackage: mockDownloadPackage,
    downloadASC: mockDownloadASC,
    verifyASC: mockVerifyASC,
    installPackage: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  useDownloadProgress: () => 0,
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('../../AppUpdate/AppUpdateForeground', () => ({
  peekDesktopUpdateBanner: () => {
    if (mockBanner?.expiresAt && mockBanner.expiresAt <= Date.now())
      mockBanner = undefined;
    return mockBanner;
  },
  startDesktopUpdateBanner: () => {
    mockStartBanner();
    if (mockBanner) mockBanner.expiresAt ??= Date.now() + 6000;
    return mockBanner;
  },
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

beforeEach(() => {
  mockRouteFocused = true;
  mockBanner = undefined;
  mockStartBanner.mockClear();
  mockCanRestart.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each([
  [EAppUpdateStatus.downloadPackageFailed, mockDownloadPackage],
  [EAppUpdateStatus.downloadASCFailed, mockDownloadASC],
  [EAppUpdateStatus.verifyASCFailed, mockVerifyASC],
  [EAppUpdateStatus.verifyPackageFailed, mockDownloadPackage],
])('retryable %s resumes the failed step', async (status, expected) => {
  mockDownloadPackage.mockClear();
  mockDownloadASC.mockClear();
  mockVerifyASC.mockClear();
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
  expect(expected).toHaveBeenCalledTimes(1);
  expect(mockDownloadPackage).toHaveBeenCalledTimes(
    status === EAppUpdateStatus.downloadPackageFailed ||
      status === EAppUpdateStatus.verifyPackageFailed
      ? 1
      : 0,
  );
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

test.each([
  'locked route',
  'inactive route',
  'inert ancestor',
  'hidden document',
  'no layout',
] as const)(
  'completion banner waits until the header is usable (%s)',
  async (blockedBy) => {
    jest.useFakeTimers();
    const offsetParent = jest
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockReturnValue(blockedBy === 'no layout' ? null : document.body);
    const visibility = jest
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue(blockedBy === 'hidden document' ? 'hidden' : 'visible');
    mockBanner = { version: '2.0.0' };
    mockRouteFocused =
      blockedBy !== 'locked route' && blockedBy !== 'inactive route';
    const data = {
      latestVersion: '2.0.0',
      updateAt: 0,
      updateStrategy: EUpdateStrategy.manual,
      status: EAppUpdateStatus.done,
    };
    const host = document.createElement('div');
    if (blockedBy === 'locked route' || blockedBy === 'inert ancestor')
      host.setAttribute('inert', '');
    document.body.appendChild(host);
    const onWhatsNew = jest.fn();
    const view = render(
      <UpdateCapsule data={data} showUpdate={false} onWhatsNew={onWhatsNew} />,
      { container: host },
    );
    await act(async () => {
      jest.advanceTimersByTime(7000);
    });
    expect(mockStartBanner).not.toHaveBeenCalled();
    expect(mockBanner?.expiresAt).toBeUndefined();
    expect(view.queryByTestId('header-update-completed')).toBeNull();
    if (blockedBy === 'locked route') {
      mockRouteFocused = true;
      view.rerender(
        <UpdateCapsule
          data={data}
          showUpdate={false}
          onWhatsNew={onWhatsNew}
        />,
      );
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(mockStartBanner).not.toHaveBeenCalled();
    }
    host.removeAttribute('inert');
    mockRouteFocused = true;
    visibility.mockReturnValue('visible');
    offsetParent.mockReturnValue(document.body);
    view.rerender(
      <UpdateCapsule data={data} showUpdate={false} onWhatsNew={onWhatsNew} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(mockStartBanner).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('header-update-completed')).toBeTruthy();
    fireEvent.click(view.getByTestId('header-update-completed'));
    expect(onWhatsNew).toHaveBeenCalledTimes(1);
    const remaining = (mockBanner?.expiresAt ?? 0) - Date.now();
    expect(remaining).toBeGreaterThanOrEqual(5900);
    await act(async () => {
      jest.advanceTimersByTime(remaining - 1);
    });
    expect(view.getByTestId('header-update-completed')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(101);
    });
    expect(view.queryByTestId('header-update-completed')).toBeNull();
    view.unmount();
    host.remove();
  },
);

test('route focus changes keep transient update timers active', async () => {
  jest.useFakeTimers();
  mockCanRestart.mockResolvedValue(false);
  const data = {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.ready,
  };
  const view = render(
    <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />,
  );
  await act(async () => {
    fireEvent.click(view.getByTestId('header-update-restart'));
  });
  expect(
    view.getByText(ETranslations.app_update_finish_first__msg),
  ).toBeTruthy();
  mockRouteFocused = false;
  view.rerender(<UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />);
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(
    view.queryByText(ETranslations.app_update_finish_first__msg),
  ).toBeNull();
  mockRouteFocused = true;
  view.rerender(
    <UpdateCapsule
      data={{ ...data, status: EAppUpdateStatus.notify }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  view.rerender(
    <UpdateCapsule
      data={{ ...data, status: EAppUpdateStatus.downloadPackage }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  expect(view.getByTestId('header-update-notify-exit')).toBeTruthy();
  mockRouteFocused = false;
  view.rerender(
    <UpdateCapsule
      data={{ ...data, status: EAppUpdateStatus.downloadPackage }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  expect(view.queryByTestId('header-update-notify-exit')).toBeNull();
});
