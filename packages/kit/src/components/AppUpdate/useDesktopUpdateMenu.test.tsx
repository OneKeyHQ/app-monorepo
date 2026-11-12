/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { registerUpdateDetailsHost } from './updateDetailsHost';
import { useDesktopUpdateMenu } from './useDesktopUpdateMenu';

const mockCheck = jest.fn();
const mockAction = jest.fn();
const mockDownload = jest.fn();
const mockAutoDownload = jest.fn(async () => true);
const mockLoadingClose = jest.fn();
const mockLoading = jest.fn(() => ({ close: mockLoadingClose }));
const mockMessage = jest.fn();
const mockLocalInfo = jest.fn<Promise<IAppUpdateInfo | undefined>, []>(
  async () => undefined,
);
let mockLocked = false;
let mockProtected = false;
const mockDialog = jest.fn((props: { onClose?: () => void }) => ({
  close: async () => {
    props.onClose?.();
  },
  isExist: () => true,
}));
const mockInfo: IAppUpdateInfo = {
  latestVersion: '99.0.0',
  updateAt: 0,
  downloadUrl: 'https://example.com/update',
  status: EAppUpdateStatus.ready,
  updateStrategy: EUpdateStrategy.manual,
};

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (props: Parameters<typeof mockDialog>[0]) => mockDialog(props),
    confirm: (props: Parameters<typeof mockDialog>[0]) => mockDialog(props),
  },
  Toast: {
    loading: () => mockLoading(),
    error: jest.fn(),
    message: (props: unknown) => {
      mockMessage(props);
    },
  },
  getDialogInstances: () =>
    mockDialog.mock.results.map(
      (call) => call.value as { isExist: () => boolean },
    ),
  Spinner: () => null,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  isBlockingLevel: () => true,
  overlayStore: {
    getSnapshot: () => ({
      entries: mockProtected
        ? [{ level: 'secure', suspended: false, blocking: true }]
        : [],
    }),
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockLocked],
  appIsLocked: { get: async () => mockLocked },
}));
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAppUpdate: { getUpdateInfo: () => mockLocalInfo() },
    serviceSetting: {
      getEnableAutoDownloadAppUpdate: () => mockAutoDownload(),
    },
  },
}));
jest.mock('./useAppUpdate', () => ({
  useAppUpdateInfo: () => ({
    checkForUpdates: mockCheck,
    onUpdateActionWithInfo: mockAction,
    downloadPackage: mockDownload,
    data: mockInfo,
  }),
  isAutoUpdateStrategy: (strategy: EUpdateStrategy) =>
    strategy === EUpdateStrategy.silent ||
    strategy === EUpdateStrategy.seamless,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { update: { app: { log: jest.fn() } } },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLocked = false;
  mockProtected = false;
  mockLocalInfo.mockResolvedValue(undefined);
  mockAutoDownload.mockResolvedValue(true);
});

test('first check shows loading, coalesces clicks and reports an up-to-date result', async () => {
  let finish: (value: {
    isNeedUpdate: boolean;
    response: IAppUpdateInfo;
  }) => void = () => {};
  mockCheck.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { result } = renderHook(useDesktopUpdateMenu);
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = result.current();
  });
  await act(async () => {
    await result.current();
  });
  expect(mockLoading).toHaveBeenCalledTimes(1);
  expect(mockCheck).toHaveBeenCalledTimes(1);
  expect(mockDialog).not.toHaveBeenCalled();
  await act(async () => {
    finish({
      isNeedUpdate: false,
      response: { ...mockInfo, status: EAppUpdateStatus.done },
    });
    await pending;
  });
  expect(mockDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      description: ETranslations.update_app_up_to_date,
    }),
  );
  expect(mockLoadingClose).toHaveBeenCalledTimes(1);
});

test.each(['network', 'empty'])(
  'first check failure (%s) offers retry and releases the request lock',
  async (failure) => {
    if (failure === 'network')
      mockCheck.mockRejectedValueOnce(new Error('offline'));
    else mockCheck.mockResolvedValueOnce({ isNeedUpdate: false });
    mockCheck.mockResolvedValueOnce({
      isNeedUpdate: false,
      response: { ...mockInfo, status: EAppUpdateStatus.done },
    });
    const { result } = renderHook(useDesktopUpdateMenu);
    await act(async () => {
      await result.current();
    });
    const props = mockDialog.mock.calls[0][0] as {
      onConfirm?: (args: { close: () => Promise<void> }) => Promise<void>;
    };
    expect(mockDialog).toHaveBeenCalledWith(
      expect.objectContaining({ onConfirmText: ETranslations.global_retry }),
    );
    const instance = mockDialog.mock.results[0].value;
    await act(async () => {
      await props.onConfirm?.({ close: instance.close });
    });
    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockLoadingClose).toHaveBeenCalledTimes(2);
    expect(mockDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        description: ETranslations.update_app_up_to_date,
      }),
    );
  },
);

test.each([EUpdateStrategy.manual, EUpdateStrategy.silent])(
  'first manual/opt-out discovery uses the checked snapshot (%s)',
  async (strategy) => {
    mockAutoDownload.mockResolvedValue(false);
    const response = {
      ...mockInfo,
      status: EAppUpdateStatus.notify,
      updateStrategy: strategy,
    };
    mockCheck.mockResolvedValue({ isNeedUpdate: true, response });
    const { result } = renderHook(useDesktopUpdateMenu);
    await act(async () => {
      await result.current();
    });
    expect(mockAction).toHaveBeenCalledWith(response);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockDialog).not.toHaveBeenCalled();
  },
);

test('first silent discovery keeps background ownership and opens status instead of preview', async () => {
  mockCheck.mockResolvedValue({
    isNeedUpdate: true,
    response: {
      ...mockInfo,
      status: EAppUpdateStatus.notify,
      updateStrategy: EUpdateStrategy.silent,
    },
  });
  const { result } = renderHook(useDesktopUpdateMenu);
  await act(async () => {
    await result.current();
  });
  expect(mockAction).not.toHaveBeenCalled();
  expect(mockDownload).not.toHaveBeenCalled();
  expect(mockDialog).toHaveBeenCalledWith(
    expect.objectContaining({ testID: 'desktop-update-details-dialog' }),
  );
});

test.each([true, false])(
  'menu details use an interactive host or immediately fall back when modal-covered (handled=%s)',
  async (handled) => {
    const host = jest.fn(() => handled);
    const unregister = registerUpdateDetailsHost(host);
    mockCheck.mockResolvedValue({ isNeedUpdate: true, response: mockInfo });
    const { result } = renderHook(useDesktopUpdateMenu);
    await act(async () => {
      await result.current();
    });
    expect(host).toHaveBeenCalledWith(mockInfo);
    if (handled) expect(mockDialog).not.toHaveBeenCalled();
    else {
      expect(mockDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          testID: 'desktop-update-details-dialog',
          showFooter: false,
        }),
      );
      await act(async () => {
        await result.current();
      });
      expect(mockDialog).toHaveBeenCalledTimes(1);
    }
    expect(mockAction).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    unregister();
  },
);

test.each(['locked', 'secure'])(
  'does not interrupt protected UI (%s)',
  async (state) => {
    mockLocked = state === 'locked';
    mockProtected = state === 'secure';
    const { result } = renderHook(useDesktopUpdateMenu);
    await act(async () => {
      await result.current();
    });
    expect(mockCheck).not.toHaveBeenCalled();
    expect(mockDialog).not.toHaveBeenCalled();
  },
);

test('a lock appearing during the first request prevents presenting its result', async () => {
  const { result, rerender } = renderHook(useDesktopUpdateMenu);
  mockCheck.mockImplementationOnce(async () => {
    mockLocked = true;
    rerender();
    return { isNeedUpdate: true, response: mockInfo };
  });
  await act(async () => {
    await result.current();
  });
  expect(mockDialog).not.toHaveBeenCalled();
  expect(mockLoadingClose).toHaveBeenCalledTimes(1);
});

test('closing modal fallback with Escape restores its underlying input and preserves the draft', async () => {
  // The shared Jest setup replaces addEventListener with a no-op.
  const previousAddListener = globalThis.addEventListener;
  const previousFrame = globalThis.requestAnimationFrame;
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
  const input = document.createElement('input');
  const focus = document.createElement('button');
  try {
    input.value = 'Perps';
    document.body.append(input);
    input.focus();
    mockCheck.mockResolvedValue({ isNeedUpdate: true, response: mockInfo });
    const { result, unmount } = renderHook(useDesktopUpdateMenu);
    const closeUnderlyingModal = jest.fn();
    globalThis.addEventListener('keyup', closeUnderlyingModal);
    await act(async () => {
      await result.current();
    });
    document.body.append(focus);
    focus.focus();
    await act(async () => {
      globalThis.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    act(() => {
      globalThis.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(closeUnderlyingModal).not.toHaveBeenCalled();
    globalThis.removeEventListener('keyup', closeUnderlyingModal);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Perps');
    unmount();
  } finally {
    input.remove();
    focus.remove();
    globalThis.addEventListener = previousAddListener;
    globalThis.requestAnimationFrame = previousFrame;
  }
});

test('refresh failure keeps existing local download details accessible', async () => {
  mockCheck.mockRejectedValue(new Error('offline'));
  mockLocalInfo.mockResolvedValue({
    ...mockInfo,
    status: EAppUpdateStatus.downloadPackage,
  });
  const { result } = renderHook(useDesktopUpdateMenu);
  await act(async () => {
    await result.current();
  });
  expect(mockDialog).toHaveBeenCalledWith(
    expect.objectContaining({ testID: 'desktop-update-details-dialog' }),
  );
  expect(mockAction).not.toHaveBeenCalled();
});

test.each([
  { updateStrategy: EUpdateStrategy.force },
  { status: EAppUpdateStatus.manualInstall },
  { storeUrl: 'https://example.com/store' },
])(
  'preserves the legacy action for force, manual installation and stores (%j)',
  async (patch) => {
    const response = { ...mockInfo, ...patch };
    mockCheck.mockResolvedValue({ isNeedUpdate: true, response });
    const { result } = renderHook(useDesktopUpdateMenu);
    await act(async () => {
      await result.current();
    });
    expect(mockAction).toHaveBeenCalledWith(response);
    expect(mockDialog).not.toHaveBeenCalled();
  },
);

test('seamless updates retain the existing background path', async () => {
  mockCheck.mockResolvedValue({
    isNeedUpdate: true,
    response: { ...mockInfo, updateStrategy: EUpdateStrategy.seamless },
  });
  const { result } = renderHook(useDesktopUpdateMenu);
  await act(async () => {
    await result.current();
  });
  expect(mockDownload).toHaveBeenCalledTimes(1);
  expect(mockAction).not.toHaveBeenCalled();
});
