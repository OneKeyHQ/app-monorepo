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
const mockPrepareUserUpdateRetry = jest.fn(
  async (_opts?: { preserveArtifact?: boolean }) => ({}),
);
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
    Divider: Container,
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
      prepareUserUpdateRetry: (opts?: { preserveArtifact?: boolean }) =>
        mockPrepareUserUpdateRetry(opts),
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

test.each([
  [EAppUpdateStatus.downloadASCFailed, mockDownloadASC],
  [EAppUpdateStatus.verifyASCFailed, mockVerifyASC],
])(
  'overlapping retries while the target gate is pending run %s once',
  async (status, expected) => {
    mockCanDownload.mockReset();
    mockDownloadPackage.mockClear();
    mockDownloadASC.mockClear();
    mockVerifyASC.mockClear();
    let resolveGate: (allowed: boolean) => void = () => {};
    mockCanDownload.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveGate = resolve;
        }),
    );
    mockCanDownload.mockResolvedValue(true);
    const view = render(
      <UpdateCapsule
        showUpdate
        onWhatsNew={() => {}}
        data={{
          latestVersion: '2.0.0',
          updateAt: 0,
          updateStrategy: EUpdateStrategy.manual,
          status,
          updateError: {
            code: EUpdateErrorCode.networkError,
            step: 'download',
          },
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(view.getByTestId('header-update-retry'));
      fireEvent.click(view.getByTestId('header-update-retry'));
    });
    // The second click must be rejected while the first one is still awaiting
    // the target gate.
    expect(mockCanDownload).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveGate(true);
    });
    expect(expected).toHaveBeenCalledTimes(1);
    // The guard must be released after the retry settles.
    await act(async () => {
      fireEvent.click(view.getByTestId('header-update-retry'));
    });
    expect(expected).toHaveBeenCalledTimes(2);
  },
);

test.each([
  [EAppUpdateStatus.downloadASCFailed, mockDownloadASC],
  [EAppUpdateStatus.verifyASCFailed, mockVerifyASC],
])(
  'denied target gate releases the in-flight retry guard for %s',
  async (status, expected) => {
    mockCanDownload.mockReset();
    mockDownloadPackage.mockClear();
    mockDownloadASC.mockClear();
    mockVerifyASC.mockClear();
    mockCanDownload.mockResolvedValueOnce(false);
    mockCanDownload.mockResolvedValue(true);
    const view = render(
      <UpdateCapsule
        showUpdate
        onWhatsNew={() => {}}
        data={{
          latestVersion: '2.0.0',
          updateAt: 0,
          updateStrategy: EUpdateStrategy.manual,
          status,
          updateError: {
            code: EUpdateErrorCode.networkError,
            step: 'download',
          },
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(view.getByTestId('header-update-retry'));
    });
    expect(expected).not.toHaveBeenCalled();
    // A denied retry must still release the guard so the user can try again.
    await act(async () => {
      fireEvent.click(view.getByTestId('header-update-retry'));
    });
    expect(expected).toHaveBeenCalledTimes(1);
  },
);

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

test('jsBundle integrity failure renders retry button instead of locking out to GitHub releases', async () => {
  mockDownloadPackage.mockClear();
  const view = render(
    <UpdateCapsule
      showUpdate
      onWhatsNew={() => {}}
      data={{
        latestVersion: '1.0.0',
        jsBundleVersion: '25',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.verifyPackageFailed,
        updateError: {
          code: EUpdateErrorCode.integrityFailed,
          step: 'verifyPackage',
        },
      }}
    />,
  );
  expect(view.getByTestId('header-update-retry')).toBeTruthy();
  expect(view.queryByTestId('header-update-github')).toBeNull();
  await act(async () => {
    fireEvent.click(view.getByTestId('header-update-retry'));
  });
  expect(mockDownloadPackage).toHaveBeenCalledWith({ userInitiated: true });
});

test.each([
  EUpdateErrorCode.integrityFailed,
  EUpdateErrorCode.securityRejected,
])(
  'jsBundle verifyASCFailed with %s clears artifact and re-downloads cleanly instead of re-verifying rejected bytes',
  async (errorCode) => {
    mockPrepareUserUpdateRetry.mockClear();
    mockDownloadPackage.mockClear();
    mockVerifyASC.mockClear();
    const view = render(
      <UpdateCapsule
        showUpdate
        onWhatsNew={() => {}}
        data={{
          latestVersion: '1.0.0',
          jsBundleVersion: '25',
          updateAt: 0,
          updateStrategy: EUpdateStrategy.manual,
          status: EAppUpdateStatus.verifyASCFailed,
          updateError: {
            code: errorCode,
            step: 'verifyASC',
          },
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(view.getByTestId('header-update-retry'));
    });
    expect(mockPrepareUserUpdateRetry).toHaveBeenCalledWith({
      preserveArtifact: false,
    });
    expect(mockDownloadPackage).toHaveBeenCalledWith({ userInitiated: true });
    expect(mockVerifyASC).not.toHaveBeenCalled();
  },
);

test('capsule retry calls prepareUserUpdateRetry before target gate so frozen/exhausted targets recover', async () => {
  let targetFrozen = true;
  mockPrepareUserUpdateRetry.mockImplementationOnce(async () => {
    targetFrozen = false;
    return {};
  });
  mockCanDownload.mockImplementationOnce(async () => !targetFrozen);
  mockDownloadPackage.mockClear();

  const view = render(
    <UpdateCapsule
      showUpdate
      onWhatsNew={() => {}}
      data={{
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/OneKey-Wallet-2.0.0.dmg',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.downloadPackageFailed,
        downloadRetryExhausted: true,
        updateError: {
          code: EUpdateErrorCode.networkError,
          step: 'download',
        },
      }}
    />,
  );
  await act(async () => {
    fireEvent.click(view.getByTestId('header-update-retry'));
  });
  expect(mockPrepareUserUpdateRetry).toHaveBeenCalledWith({
    preserveArtifact: false,
  });
  expect(mockDownloadPackage).toHaveBeenCalledWith({ userInitiated: true });
});

test('capsule downloadASCFailed retry preserves artifact when clearing user retry freeze', async () => {
  mockPrepareUserUpdateRetry.mockClear();
  mockDownloadASC.mockClear();
  const view = render(
    <UpdateCapsule
      showUpdate
      onWhatsNew={() => {}}
      data={{
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/OneKey-Wallet-2.0.0.dmg',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.downloadASCFailed,
        updateError: {
          code: EUpdateErrorCode.networkError,
          step: 'downloadASC',
        },
      }}
    />,
  );
  await act(async () => {
    fireEvent.click(view.getByTestId('header-update-retry'));
  });
  expect(mockPrepareUserUpdateRetry).toHaveBeenCalledWith({
    preserveArtifact: true,
  });
  expect(mockDownloadASC).toHaveBeenCalledTimes(1);
});

test('install-time integrityFailed marks receipt Contents as Changed instead of Unchanged', () => {
  const { UpdateVerifyReceipt: RealReceipt } = jest.requireActual(
    './UpdateVerifyReceipt',
  ) as typeof import('./UpdateVerifyReceipt');
  const view = render(
    <RealReceipt
      percent={100}
      reducedMotion
      data={{
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/OneKey-Wallet-2.0.0.dmg',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.verifyPackageFailed,
        updateError: {
          code: EUpdateErrorCode.integrityFailed,
          step: 'install',
        },
      }}
    />,
  );
  expect(
    view.getByText(ETranslations.app_update_contents_changed__msg),
  ).toBeTruthy();
  expect(
    view.queryByText(ETranslations.app_update_contents_unchanged__msg),
  ).toBeNull();
});

test('stale integrityFailed error does not lock active download into securityError mode', () => {
  const view = render(
    <UpdateCapsule
      showUpdate
      onWhatsNew={() => {}}
      data={{
        latestVersion: '2.0.0',
        downloadUrl: 'https://cdn.onekey.so/OneKey-Wallet-2.0.0.dmg',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.downloadPackage,
        updateError: {
          code: EUpdateErrorCode.integrityFailed,
          step: 'verifyPackage',
        },
      }}
    />,
  );
  expect(view.queryByTestId('header-update-github')).toBeNull();
  expect(
    view.queryByText(ETranslations.app_update_cant_continue__msg),
  ).toBeNull();
});
