/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EUpdateErrorCode } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import { useDownloadProgressDetails } from '@onekeyhq/shared/src/modules3rdParty/auto-update/index.desktop';

import { tryOpenUpdateDetails } from '../../AppUpdate/updateDetailsHost';

import { UpdateCapsule as NonDesktopUpdateCapsule } from './UpdateCapsule';
import { UpdateCapsule } from './UpdateCapsule.desktop';

const mockInstallPackage = jest.fn(async () => {});
const mockDownloadPackage = jest.fn();
const mockDownloadASC = jest.fn();
const mockVerifyASC = jest.fn();
const mockCanDownload = jest.fn(async () => true);
const mockCanRestart = jest.fn(async () => true);
const mockPrepareUserUpdateRetry = jest.fn(
  async (_opts?: { preserveArtifact?: boolean }) => ({}),
);
const mockStartBanner = jest.fn();
let mockBlockingOverlay = false;
let mockRouteFocused = true;
let mockWideHeader = false;
let mockBanner: { version: string; expiresAt?: number } | undefined;

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  isBlockingLevel: (level: string) => level !== 'toast',
  overlayStore: {
    getSnapshot: () => ({
      entries: [
        { level: 'hardware', suspended: false, blocking: false },
        ...(mockBlockingOverlay
          ? [{ level: 'modal', suspended: false, blocking: true }]
          : []),
      ],
    }),
  },
}));

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
      variant,
      width,
      'aria-label': ariaLabel,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
      disabled?: boolean;
      id?: string;
      variant?: string;
      width?: number;
      'aria-label'?: string;
    }) => (
      <button
        id={id}
        data-testid={testID}
        data-variant={variant}
        style={{ width }}
        aria-label={ariaLabel}
        onClick={onPress}
        disabled={disabled}
      >
        {children}
      </button>
    ),
    Icon: () => null,
    Spinner: () => null,
    Divider: Container,
    Toast: { error: jest.fn(), message: jest.fn() },
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    Tooltip: ({
      renderTrigger,
      renderContent,
    }: {
      renderTrigger: ReactNode;
      renderContent: string;
    }) => <span data-tooltip={renderContent}>{renderTrigger}</span>,
    Popover: ({
      renderTrigger,
      renderContent,
      open,
    }: {
      renderTrigger: ReactNode;
      renderContent: ReactNode;
      open?: boolean;
    }) => (
      <div data-testid="update-test-popover" data-open={String(open)}>
        {renderTrigger}
        {renderContent}
      </div>
    ),
    useMedia: () => ({ gtXl: mockWideHeader, gtLg: mockWideHeader }),
    useTheme: () => ({
      neutral5: { val: '#ddd' },
      iconSubdued: { val: '#777' },
    }),
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
    installPackage: mockInstallPackage,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/auto-update/index.desktop',
  () => ({
    useDownloadProgressDetails: jest.fn(() => ({
      percent: 0,
      total: 0,
      transferred: 0,
    })),
  }),
);
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('../../AppUpdate/AppUpdateForeground', () => ({
  consumeDesktopUpdateBanner: (version: string) => {
    if (mockBanner?.version === version) mockBanner = undefined;
  },
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
  mockBlockingOverlay = false;
  mockRouteFocused = true;
  mockWideHeader = false;
  mockBanner = undefined;
  mockStartBanner.mockClear();
  mockCanRestart.mockClear();
  mockCanRestart.mockResolvedValue(true);
  mockInstallPackage.mockReset();
  mockInstallPackage.mockResolvedValue(undefined);
  jest.mocked(Toast.message).mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each([false, true])(
  'ready details has its own tooltip at wide=%s',
  (wide) => {
    mockWideHeader = wide;
    const view = render(
      <UpdateCapsule
        data={{
          latestVersion: '2.0.0',
          updateAt: 0,
          updateStrategy: EUpdateStrategy.manual,
          status: EAppUpdateStatus.ready,
        }}
        showUpdate
        onWhatsNew={() => {}}
      />,
    );
    const details = view.getByTestId('header-update-details');
    const restart = view.getByTestId('header-update-restart');
    expect(
      details.closest('[data-tooltip]')?.getAttribute('data-tooltip'),
    ).toBe(ETranslations.app_update_details__title);
    expect(
      restart.closest('[data-tooltip]')?.getAttribute('data-tooltip'),
    ).toBe(ETranslations.app_update_restart__action);
    expect(details.getAttribute('aria-label')).toBe(
      `${ETranslations.app_update_restart__action} · ${ETranslations.app_update_details__title}`,
    );
  },
);

test('keeps app-shell progress scope stable until the target version changes', () => {
  const data = {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.downloadPackage,
  };
  const progressHook = jest.mocked(useDownloadProgressDetails);
  const view = render(
    <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />,
  );
  const scope = progressHook.mock.lastCall?.[0];
  expect(scope).toEqual({ latestVersion: '2.0.0' });
  view.rerender(
    <UpdateCapsule data={{ ...data }} showUpdate onWhatsNew={() => {}} />,
  );
  expect(progressHook.mock.lastCall?.[0]).toBe(scope);
  view.rerender(
    <UpdateCapsule
      data={{ ...data, latestVersion: '3.0.0' }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  expect(progressHook.mock.lastCall?.[0]).not.toBe(scope);
  expect(progressHook.mock.lastCall?.[0]).toEqual({ latestVersion: '3.0.0' });
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
  expect(view.getByTestId('header-update-whats-new').textContent).toBe(
    ETranslations.settings_whats_new,
  );
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
    expect(mockBanner).toBeUndefined();
    expect(view.queryByTestId('header-update-completed')).toBeNull();
    view.rerender(<></>);
    view.rerender(
      <UpdateCapsule data={data} showUpdate={false} onWhatsNew={onWhatsNew} />,
    );
    expect(view.queryByTestId('header-update-completed')).toBeNull();
    view.unmount();
    host.remove();
  },
);

test('unclicked completion banner expires naturally after six seconds', async () => {
  jest.useFakeTimers();
  jest
    .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
    .mockReturnValue(document.body);
  mockBanner = { version: '2.0.0' };
  const view = render(
    <UpdateCapsule
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.done,
      }}
      showUpdate={false}
      onWhatsNew={() => {}}
    />,
  );
  expect(view.getByTestId('header-update-completed')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(5900);
  });
  expect(view.getByTestId('header-update-completed')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  expect(view.queryByTestId('header-update-completed')).toBeNull();
  expect(mockBanner).toBeUndefined();
});

test('clicking an old completion banner preserves a newer version', () => {
  jest
    .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
    .mockReturnValue(document.body);
  mockBanner = { version: '2.0.0' };
  const data = {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.done,
  };
  const view = render(
    <UpdateCapsule data={data} showUpdate={false} onWhatsNew={() => {}} />,
  );
  mockBanner = { version: '3.0.0' };
  fireEvent.click(view.getByTestId('header-update-completed'));
  expect(mockBanner?.version).toBe('3.0.0');
  expect(view.queryByTestId('header-update-completed')).toBeNull();
  view.unmount();
  const remounted = render(
    <UpdateCapsule data={data} showUpdate={false} onWhatsNew={() => {}} />,
  );
  expect(remounted.getByTestId('header-update-completed')).toBeTruthy();
  expect(mockBanner?.version).toBe('3.0.0');
});

test('ordinary details link does not consume a completion banner', () => {
  const onWhatsNew = jest.fn();
  const view = render(
    <UpdateCapsule
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.ready,
      }}
      showUpdate
      onWhatsNew={onWhatsNew}
    />,
  );
  mockBanner = { version: '3.0.0' };
  fireEvent.click(view.getByTestId('header-update-whats-new'));
  expect(onWhatsNew).toHaveBeenCalledTimes(1);
  expect(mockBanner?.version).toBe('3.0.0');
});

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
      progress={{ percent: 100, total: 0, transferred: 0 }}
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

test.each([false, true])('manual download respects wide=%s', (wide) => {
  mockWideHeader = wide;
  const data = {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.notify,
  };
  const view = render(
    <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />,
  );
  const button = view.getByTestId('header-update-button');
  expect(button.textContent).toBe(wide ? ETranslations.global_update : '');
  expect(button.style.width).toBe(wide ? '' : '30px');
  expect(button.getAttribute('aria-label')).toBe(ETranslations.global_update);
});

test.each([
  [
    EAppUpdateStatus.downloadPackageFailed,
    ETranslations.update_downloading_package,
  ],
  [EAppUpdateStatus.downloadASCFailed, ETranslations.update_verifying],
  [EAppUpdateStatus.verifyASCFailed, ETranslations.update_verifying],
  [EAppUpdateStatus.verifyPackageFailed, ETranslations.update_verifying],
])(
  'transient %s keeps a quiet status until retries are exhausted',
  (status, label) => {
    const data = {
      latestVersion: '2.0.0',
      updateAt: 0,
      updateStrategy: EUpdateStrategy.manual,
      status,
      updateError: {
        code: EUpdateErrorCode.networkError,
        step: 'download' as const,
      },
    };
    const view = render(
      <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />,
    );
    expect(
      view.getByTestId('header-update-details').getAttribute('data-variant'),
    ).toBe('tertiary');
    expect(
      view.getByTestId('header-update-details').getAttribute('aria-label'),
    ).toContain(label);
    expect(
      view.queryByText(ETranslations.app_update_cant_continue__msg),
    ).toBeNull();
    expect(view.getByTestId('header-update-retry')).toBeTruthy();
    view.rerender(
      <UpdateCapsule
        data={{ ...data, downloadRetryExhausted: true }}
        showUpdate
        onWhatsNew={() => {}}
      />,
    );
    expect(
      view.getByTestId('header-update-details').getAttribute('aria-label'),
    ).toContain(ETranslations.app_update_cant_continue__msg);
  },
);

test.each([EAppUpdateStatus.failed, EAppUpdateStatus.updateIncomplete])(
  '%s preserves install timeout errors and manual retry',
  async (status) => {
    mockDownloadPackage.mockClear();
    const view = render(
      <UpdateCapsule
        data={{
          latestVersion: '2.0.0',
          updateAt: 0,
          updateStrategy: EUpdateStrategy.manual,
          status,
          updateError: { code: EUpdateErrorCode.timeout, step: 'install' },
        }}
        showUpdate
        onWhatsNew={() => {}}
      />,
    );
    expect(
      view.getByTestId('header-update-details').getAttribute('aria-label'),
    ).toContain(ETranslations.app_update_cant_continue__msg);
    expect(
      view.getByText(ETranslations.app_update_cant_continue__msg),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(view.getByTestId('header-update-retry'));
    });
    expect(mockDownloadPackage).toHaveBeenCalledTimes(1);
  },
);

test.each([false, true])(
  'completed banner keeps its quiet style and narrow icon at wide=%s',
  (wide) => {
    mockWideHeader = wide;
    jest
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockReturnValue(document.body);
    mockBanner = { version: '2.0.0' };
    const view = render(
      <UpdateCapsule
        data={{
          latestVersion: '2.0.0',
          updateAt: 0,
          updateStrategy: EUpdateStrategy.manual,
          status: EAppUpdateStatus.done,
        }}
        showUpdate={false}
        onWhatsNew={() => {}}
      />,
    );
    const button = view.getByTestId('header-update-completed');
    expect(button.getAttribute('data-variant')).toBe('tertiary');
    expect(button.style.width).toBe(wide ? '' : '30px');
    expect(button.textContent).toBe(
      wide ? ETranslations.app_update_updated__msg : '',
    );
    expect(button.getAttribute('aria-label')).toBe(
      ETranslations.app_update_updated__msg,
    );
  },
);

test('menu details request opens the visible capsule and ignores an inactive route', () => {
  jest
    .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
    .mockReturnValue(document.body);
  jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const data = {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.ready,
  };
  const view = render(
    <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />,
  );
  const details = view.getByTestId('header-update-details');
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => details,
  });
  act(() => {
    tryOpenUpdateDetails(data);
  });
  expect(
    view.getByTestId('update-test-popover').getAttribute('data-open'),
  ).toBe('true');
  expect(document.activeElement).toBe(details);
  mockRouteFocused = false;
  view.rerender(<UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />);
  act(() => {
    tryOpenUpdateDetails(data);
  });
  expect(
    view.getByTestId('update-test-popover').getAttribute('data-open'),
  ).toBe('false');
  Reflect.deleteProperty(document, 'elementFromPoint');
});

test.each(['scrim', 'dialog', 'inactive', 'target'])(
  'does not open a background capsule for %s',
  (obstruction) => {
    jest
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockReturnValue(document.body);
    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const data = {
      latestVersion: '2.0.0',
      updateAt: 0,
      updateStrategy: EUpdateStrategy.manual,
      status: EAppUpdateStatus.ready,
    };
    mockRouteFocused = obstruction !== 'inactive';
    mockBlockingOverlay = obstruction === 'dialog';
    const view = render(
      <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />,
    );
    const button = view.getByTestId('header-update-details');
    const scrim = document.createElement('div');
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => (obstruction === 'scrim' ? scrim : button),
    });
    let handled = true;
    act(() => {
      handled = tryOpenUpdateDetails(
        obstruction === 'target' ? { ...data, latestVersion: '3.0.0' } : data,
      );
    });
    expect(handled).toBe(false);
    expect(
      view.getByTestId('update-test-popover').getAttribute('data-open'),
    ).toBe('false');
    expect(document.activeElement).not.toBe(button);
    Reflect.deleteProperty(document, 'elementFromPoint');
  },
);

test('menu details are claimed by only one of multiple eligible headers', () => {
  jest
    .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
    .mockReturnValue(document.body);
  jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const data = {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.ready,
  };
  const view = render(
    <>
      <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />
      <UpdateCapsule data={data} showUpdate onWhatsNew={() => {}} />
    </>,
  );
  const buttons = view.getAllByTestId('header-update-details');
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => buttons[0],
  });
  act(() => {
    expect(tryOpenUpdateDetails(data)).toBe(true);
  });
  expect(
    view
      .getAllByTestId('update-test-popover')
      .map((el) => el.getAttribute('data-open')),
  ).toEqual(['true', 'false']);
  Reflect.deleteProperty(document, 'elementFromPoint');
});

test('dialog details preserve signature quarantine without showing a capsule or a retry action', () => {
  const view = render(
    <UpdateCapsule
      detailsOnly
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.verifyASCFailed,
        updateError: {
          code: EUpdateErrorCode.securityRejected,
          step: 'verifyASC',
        },
      }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  expect(view.queryByTestId('header-update-details')).toBeNull();
  expect(view.queryByTestId('header-update-retry')).toBeNull();
  expect(view.getByTestId('header-update-github')).toBeTruthy();
});

test('fallback details gain a working restart action when the update becomes ready', async () => {
  let finishInstall = () => {};
  mockInstallPackage.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishInstall = resolve;
      }),
  );
  const data = {
    latestVersion: '2.0.0',
    updateAt: 0,
    updateStrategy: EUpdateStrategy.manual,
    status: EAppUpdateStatus.downloadPackage,
  };
  const view = render(
    <UpdateCapsule detailsOnly data={data} showUpdate onWhatsNew={() => {}} />,
  );
  expect(view.queryByTestId('update-details-restart')).toBeNull();
  view.rerender(
    <UpdateCapsule
      detailsOnly
      data={{ ...data, status: EAppUpdateStatus.ready }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  const button = view.getByTestId('update-details-restart');
  expect(button.textContent).toBe(ETranslations.app_update_restart__action);
  await act(async () => {
    fireEvent.click(button);
  });
  expect(mockCanRestart).toHaveBeenCalledTimes(1);
  expect(mockInstallPackage).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    { userInitiated: true, installSource: 'capsule' },
  );
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.click(button);
  expect(mockInstallPackage).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishInstall();
  });
  expect(button.hasAttribute('disabled')).toBe(false);
  expect(view.queryByTestId('header-update-details')).toBeNull();
});

test('fallback restart respects the busy gate and keeps the details visible', async () => {
  mockCanRestart.mockResolvedValue(false);
  const view = render(
    <UpdateCapsule
      detailsOnly
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status: EAppUpdateStatus.ready,
      }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  await act(async () => {
    fireEvent.click(view.getByTestId('update-details-restart'));
  });
  expect(mockCanRestart).toHaveBeenCalledTimes(1);
  expect(mockInstallPackage).not.toHaveBeenCalled();
  expect(Toast.message).toHaveBeenCalledWith({
    title: ETranslations.app_update_finish_first__msg,
  });
  expect(view.getByTestId('header-update-whats-new')).toBeTruthy();
  expect(
    view.getByTestId('update-details-restart').hasAttribute('disabled'),
  ).toBe(false);
});

test.each([
  EAppUpdateStatus.notify,
  EAppUpdateStatus.downloadPackage,
  EAppUpdateStatus.verifyASCFailed,
])('fallback details do not offer restart for %s', (status) => {
  const view = render(
    <UpdateCapsule
      detailsOnly
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        status,
      }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  expect(view.queryByTestId('update-details-restart')).toBeNull();
});

test('non-desktop capsule entry renders nothing', () => {
  const view = render(
    <NonDesktopUpdateCapsule
      data={{
        latestVersion: '2.0.0',
        updateAt: 0,
        status: EAppUpdateStatus.ready,
        updateStrategy: EUpdateStrategy.manual,
      }}
      showUpdate
      onWhatsNew={() => {}}
    />,
  );
  expect(view.container.childElementCount).toBe(0);
});
