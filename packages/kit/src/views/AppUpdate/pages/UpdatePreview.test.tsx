/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, import/first, vars-on-top, no-var */

// UpdatePreview first-frame force-lock tests
//
// Regression coverage for the jotai persist hydration race (PR #11704).
// The page seeds `updateInfo` from the useAppUpdatePersistAtom() snapshot,
// which during the race is still the non-force placeholder on first paint.
// Deriving the lock purely from that snapshot would leave a *mandatory*
// (force) update briefly dismissible until fetchAppUpdateInfo() resolves.
// The route param — derived from authoritative state at navigation time —
// must win on the first frame.
//
// yarn jest packages/kit/src/views/AppUpdate/pages/UpdatePreview.test.tsx

jest.mock('@react-navigation/core', () => {
  const fn = jest.fn();
  (globalThis as any).__usePreventRemove = fn;
  return { usePreventRemove: fn };
});

jest.mock('react-native', () => {
  const addEventListener = jest.fn(() => ({ remove: jest.fn() }));
  (globalThis as any).__appStateAddEventListener = addEventListener;
  return {
    AppState: {
      addEventListener,
    },
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

// The root jest.config maps `@onekeyhq/components` AND every deeper subpath
// (including `.../src/content/Markdown`) to the same componentsMock.ts via an
// unanchored regex, so a single factory must expose every named export both
// import paths need — otherwise a second jest.mock for a subpath would
// clobber this one (same resolved file).
jest.mock('@onekeyhq/components', () => {
  const React = require('react');
  const Passthrough = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  const Page: any = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  const pageHeaderFn = jest.fn(() => null);
  (globalThis as any).__pageHeaderFn = pageHeaderFn;
  Page.Header = pageHeaderFn;
  Page.Body = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  return {
    Page,
    ScrollView: Passthrough,
    SizableText: Passthrough,
    YStack: Passthrough,
    Markdown: () => null,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  // Pre-hydration placeholder: non-force (manual = 2), version 0.0.0.
  const holder = {
    value: { status: 'done', updateStrategy: 2, latestVersion: '0.0.0' },
  };
  (globalThis as any).__atomHolder = holder;
  return { useAppUpdatePersistAtom: () => [holder.value] };
});

jest.mock('@onekeyhq/shared/src/appUpdate', () => ({
  displayAppUpdateVersion: () => 'v',
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_t, p) => p }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { appUpdate: { changelogViewed: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtension: false },
}));

jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => {
  const showIntercom = jest.fn(() => Promise.resolve());
  (globalThis as any).__showIntercom = showIntercom;
  return { showIntercom };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const fetchAppUpdateInfo = jest.fn();
  (globalThis as any).__fetchAppUpdateInfo = fetchAppUpdateInfo;
  return {
    __esModule: true,
    default: { serviceAppUpdate: { fetchAppUpdateInfo } },
  };
});

// force = 1 per EUpdateStrategy; mirror the real predicate.
jest.mock('../../../components/AppUpdate', () => ({
  isForceUpdateStrategy: (strategy: number) => strategy === 1,
}));

jest.mock('../components/UpdatePreviewActionButton', () => {
  const actionButtonFn = jest.fn(() => null);
  (globalThis as any).__actionButtonFn = actionButtonFn;
  return {
    UpdatePreviewActionButton: actionButtonFn,
  };
});

jest.mock('../components/ViewUpdateHistory', () => ({
  ViewUpdateHistory: () => null,
}));

import { act, render, renderHook } from '@testing-library/react';

import {
  CONTACT_SUPPORT_HANDOFF_WAIT_MS,
  markPendingContactSupportHandoff,
  useForceUpdateContactSupport,
  waitForContactSupportHandoff,
} from '../hooks/useForceUpdateContactSupport';

import UpdatePreview from './UpdatePreview';

const g = globalThis as any;
const usePreventRemove = g.__usePreventRemove as jest.Mock;
const atomHolder = g.__atomHolder as { value: any };
const fetchAppUpdateInfo = g.__fetchAppUpdateInfo as jest.Mock;
const showIntercom = g.__showIntercom as jest.Mock;
const actionButtonFn = g.__actionButtonFn as jest.Mock;
const pageHeaderFn = g.__pageHeaderFn as jest.Mock;
const appStateAddEventListener = g.__appStateAddEventListener as jest.Mock;

function renderPreview(params: Record<string, unknown>) {
  return render(
    // route is the only prop the page reads.
    <UpdatePreview route={{ params } as any} {...({} as any)} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the placeholder snapshot before each test.
  atomHolder.value = {
    status: 'done',
    updateStrategy: 2,
    latestVersion: '0.0.0',
  };
  // Default: fetch never resolves during the test so we observe the
  // first-frame lock value without the post-fetch re-render.
  fetchAppUpdateInfo.mockReturnValue(new Promise(() => {}));
});

describe('UpdatePreview first-frame force lock', () => {
  test('force route param locks the page on first render even while the atom is still the non-force placeholder', () => {
    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });

    // usePreventRemove(true, ...) must fire on the very first render — the
    // mandatory update cannot be dismissible during the hydration window.
    expect(usePreventRemove).toHaveBeenCalled();
    expect(usePreventRemove.mock.calls[0][0]).toBe(true);
  });

  test('non-force open stays unlocked on first render (no over-locking)', () => {
    renderPreview({ isForceUpdate: false, latestVersion: '2.0.0' });

    expect(usePreventRemove).toHaveBeenCalled();
    expect(usePreventRemove.mock.calls[0][0]).toBe(false);
  });

  test('unlocks a force-opened preview when remote response downgrades strategy to non-force (forceUpdateWhitelist)', async () => {
    fetchAppUpdateInfo.mockResolvedValueOnce({
      status: 'notify',
      updateStrategy: 2,
      latestVersion: '2.0.0',
    });

    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });
    expect(usePreventRemove.mock.calls[0][0]).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
  });

  test('keeps fail-safe lock when remote fetch rejects or resolves undefined', async () => {
    fetchAppUpdateInfo.mockRejectedValueOnce(new Error('network error'));

    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);
  });

  test('contact support opens Intercom and unlocks page once server adds device to forceUpdateWhitelist', async () => {
    jest.useFakeTimers();
    try {
      fetchAppUpdateInfo
        .mockResolvedValueOnce({
          status: 'notify',
          updateStrategy: 1,
          latestVersion: '2.0.0',
        })
        .mockResolvedValueOnce({
          status: 'notify',
          updateStrategy: 2,
          latestVersion: '2.0.0',
        });

      renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });

      await act(async () => {
        await Promise.resolve();
      });

      expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);
      const lastActionProps = actionButtonFn.mock.calls.at(-1)?.[0];
      expect(lastActionProps?.isForceUpdate).toBe(true);
      expect(typeof lastActionProps?.onContactSupport).toBe('function');
      expect(typeof pageHeaderFn.mock.calls.at(-1)?.[0]?.headerLeft).toBe(
        'function',
      );

      await act(async () => {
        lastActionProps.onContactSupport();
        await Promise.resolve();
      });

      expect(showIntercom).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(10_000);
        await Promise.resolve();
      });

      expect(fetchAppUpdateInfo).toHaveBeenCalledTimes(2);
      expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
      expect(actionButtonFn.mock.calls.at(-1)?.[0]?.isForceUpdate).toBe(false);
      expect(pageHeaderFn.mock.calls.at(-1)?.[0]?.headerLeft).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  test("re-fetches update info on AppState 'active' while force-locked and unlocks if whitelisted", async () => {
    let appStateHandler: ((state: string) => void) | undefined;
    appStateAddEventListener.mockImplementation(
      (_type: string, handler: (state: string) => void) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      },
    );

    fetchAppUpdateInfo
      .mockResolvedValueOnce({
        status: 'notify',
        updateStrategy: 1,
        latestVersion: '2.0.0',
      })
      .mockResolvedValueOnce({
        status: 'notify',
        updateStrategy: 2,
        latestVersion: '2.0.0',
      });

    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });

    await act(async () => {
      await Promise.resolve();
    });
    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);
    expect(typeof appStateHandler).toBe('function');

    await act(async () => {
      appStateHandler?.('active');
      await Promise.resolve();
    });

    expect(fetchAppUpdateInfo).toHaveBeenCalledTimes(2);
    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
  });

  test('ignores an older refresh that resolves after a newer one', async () => {
    let appStateHandler: ((state: string) => void) | undefined;
    appStateAddEventListener.mockImplementation(
      (_type: string, handler: (state: string) => void) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      },
    );
    let resolveOlder: (value: unknown) => void = () => undefined;
    let resolveNewer: (value: unknown) => void = () => undefined;
    fetchAppUpdateInfo
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOlder = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveNewer = resolve;
        }),
      );

    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });
    await act(async () => {
      appStateHandler?.('active');
      await Promise.resolve();
    });
    expect(fetchAppUpdateInfo).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveNewer({
        status: 'notify',
        updateStrategy: 1,
        latestVersion: '2.0.0',
      });
      await Promise.resolve();
    });
    await act(async () => {
      resolveOlder({
        status: 'notify',
        updateStrategy: 2,
        latestVersion: '2.0.0',
      });
      await Promise.resolve();
    });

    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);
  });

  test('applies an older whitelist response when a newer refresh fails', async () => {
    let appStateHandler: ((state: string) => void) | undefined;
    appStateAddEventListener.mockImplementation(
      (_type: string, handler: (state: string) => void) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      },
    );
    let resolveOlder: (value: unknown) => void = () => undefined;
    let rejectNewer: (reason: unknown) => void = () => undefined;
    fetchAppUpdateInfo
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOlder = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectNewer = reject;
        }),
      );

    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });
    await act(async () => {
      appStateHandler?.('active');
      await Promise.resolve();
    });
    expect(fetchAppUpdateInfo).toHaveBeenCalledTimes(2);

    await act(async () => {
      rejectNewer(new Error('network error'));
      await Promise.resolve();
    });
    await act(async () => {
      resolveOlder({
        status: 'notify',
        updateStrategy: 2,
        latestVersion: '2.0.0',
      });
      await Promise.resolve();
    });

    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
  });

  test('continues polling after FeaturedChangelogDialog handoff via markPendingContactSupportHandoff', async () => {
    jest.useFakeTimers();
    try {
      fetchAppUpdateInfo
        .mockResolvedValueOnce({
          status: 'notify',
          updateStrategy: 1,
          latestVersion: '2.0.0',
        })
        .mockResolvedValueOnce({
          status: 'notify',
          updateStrategy: 2,
          latestVersion: '2.0.0',
        });

      markPendingContactSupportHandoff();
      renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });

      await act(async () => {
        await Promise.resolve();
      });
      expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(10_000);
        await Promise.resolve();
      });

      expect(fetchAppUpdateInfo).toHaveBeenCalledTimes(2);
      expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('resolves the support handoff only after UpdatePreview mounts and takes over the lock', async () => {
    jest.useFakeTimers();
    try {
      fetchAppUpdateInfo.mockResolvedValue({
        status: 'notify',
        updateStrategy: 1,
        latestVersion: '2.0.0',
      });
      markPendingContactSupportHandoff();
      const accepted = jest.fn();
      void waitForContactSupportHandoff().then(accepted);
      await act(async () => {
        await Promise.resolve();
      });
      expect(accepted).not.toHaveBeenCalled();

      const preview = renderPreview({
        isForceUpdate: true,
        latestVersion: '2.0.0',
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(accepted).toHaveBeenCalledWith(true);
      // A later waiter for the same handoff does not wait again.
      await expect(waitForContactSupportHandoff()).resolves.toBe(true);
      // Unmount under the fake clock so its recheck timers stay in this test.
      preview.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  test('releases a superseded handoff and never lets an older acceptance satisfy a newer one', async () => {
    jest.useFakeTimers();
    try {
      fetchAppUpdateInfo.mockResolvedValue({
        status: 'notify',
        updateStrategy: 1,
        latestVersion: '2.0.0',
      });
      markPendingContactSupportHandoff();
      const first = renderPreview({
        isForceUpdate: true,
        latestVersion: '2.0.0',
      });
      await act(async () => {
        await Promise.resolve();
      });
      await expect(waitForContactSupportHandoff()).resolves.toBe(true);

      markPendingContactSupportHandoff();
      const superseded = jest.fn();
      void waitForContactSupportHandoff().then(superseded);
      markPendingContactSupportHandoff();
      await Promise.resolve();
      expect(superseded).toHaveBeenCalledWith(false);

      // The first page's acceptance belongs to an older handoff.
      const latest = jest.fn();
      void waitForContactSupportHandoff().then(latest);
      await Promise.resolve();
      expect(latest).not.toHaveBeenCalled();
      const second = renderPreview({
        isForceUpdate: true,
        latestVersion: '2.0.0',
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(latest).toHaveBeenCalledWith(true);
      first.unmount();
      second.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  test('falls back when no page takes over the support handoff', async () => {
    jest.useFakeTimers();
    try {
      markPendingContactSupportHandoff();
      const timersBefore = jest.getTimerCount();
      const accepted = jest.fn();
      void waitForContactSupportHandoff().then(accepted);
      expect(jest.getTimerCount()).toBe(timersBefore + 1);
      // Nothing renders here; plain timers keep React's act() scheduling out
      // of the timer count.
      jest.advanceTimersByTime(CONTACT_SUPPORT_HANDOFF_WAIT_MS - 1);
      await Promise.resolve();
      expect(accepted).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      expect(accepted).toHaveBeenCalledWith(false);
      expect(jest.getTimerCount()).toBe(timersBefore);
    } finally {
      jest.useRealTimers();
    }
  });

  test('unlocks underlying UpdatePreview when a sibling hook instance (e.g. DownloadVerify) receives whitelisted response', async () => {
    // Initial fetch on UpdatePreview fails (offline), keeping fail-safe lock.
    fetchAppUpdateInfo.mockRejectedValueOnce(new Error('offline'));
    renderPreview({ isForceUpdate: true, latestVersion: '2.0.0' });

    await act(async () => {
      await Promise.resolve();
    });
    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(true);

    // Sibling DownloadVerify hook mounts on top and fetches whitelisted strategy=2.
    fetchAppUpdateInfo.mockResolvedValueOnce({
      status: 'downloadPackageFailed',
      updateStrategy: 2,
      latestVersion: '2.0.0',
    });
    const sibling = renderHook(() =>
      useForceUpdateContactSupport({ initialForceUpdate: true }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(sibling.result.current.isForceUpdate).toBe(false);
    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
    sibling.unmount();
  });
});
