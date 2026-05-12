/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, import/first */
// Tests for the 24-hour dialog throttle on showUpdateDialogUI. Without
// the throttle, every cold-launch fetchUpdateInfo path that finds an
// available update would re-pop the dialog — harassment-grade UX. The
// service-side `lastUpdateDialogShownAt` checkpoint guards this; the UI
// layer trusts and enforces it.
//
// yarn jest packages/kit/src/components/AppUpdate/updateDialogs.test.tsx

jest.mock('@onekeyhq/components', () => {
  const dialogShow = jest.fn();
  (globalThis as any).__mockDialogShow = dialogShow;
  return {
    Dialog: { show: jest.fn() },
    LottieView: () => null,
    YStack: ({ children }: { children: unknown }) => children as JSX.Element,
    useInTabDialog: () => ({ show: dialogShow }),
  };
});

jest.mock(
  '@onekeyhq/kit/assets/animations/update-notification-dark.json',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/assets/animations/update-notification-light.json',
  () => ({}),
);

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    getTimeDurationMs: ({ seconds, minute, hour, day }: any = {}) => {
      if (day) return day * 86_400_000;
      if (hour) return hour * 3_600_000;
      if (minute) return minute * 60_000;
      if (seconds) return seconds * 1000;
      return 0;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { component: { closedInUpdateDialog: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: false },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => {
  const updateLastDialogShownAt = jest.fn().mockResolvedValue(undefined);
  (globalThis as any).__mockUpdateLastDialogShownAt = updateLastDialogShownAt;
  return {
    __esModule: true,
    default: { serviceAppUpdate: { updateLastDialogShownAt } },
  };
});

jest.mock('react-intl', () => ({}));

import { UPDATE_DIALOG_INTERVAL, showUpdateDialogUI } from './updateDialogs';

const dialogShow = (globalThis as any).__mockDialogShow as jest.Mock;
const updateLastDialogShownAt = (globalThis as any)
  .__mockUpdateLastDialogShownAt as jest.Mock;

const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as any;

const baseArgs = (overrides: { lastUpdateDialogShownAt?: number } = {}) => ({
  dialog: { show: dialogShow } as any,
  intl,
  themeVariant: 'light' as const,
  summary: 'release notes',
  onConfirm: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  dialogShow.mockClear();
  updateLastDialogShownAt.mockClear();
});

describe('UPDATE_DIALOG_INTERVAL', () => {
  test('is exactly 24 hours (1 day) — change requires explicit UX review', () => {
    expect(UPDATE_DIALOG_INTERVAL).toBe(86_400_000);
  });
});

describe('showUpdateDialogUI', () => {
  test('shows the dialog and checkpoints the timestamp when no prior dialog has been shown', () => {
    showUpdateDialogUI(baseArgs());
    expect(dialogShow).toHaveBeenCalledTimes(1);
    expect(updateLastDialogShownAt).toHaveBeenCalledTimes(1);
  });

  test('suppresses the dialog when the previous one was shown <24h ago', () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    showUpdateDialogUI(baseArgs({ lastUpdateDialogShownAt: oneHourAgo }));
    expect(dialogShow).not.toHaveBeenCalled();
    expect(updateLastDialogShownAt).not.toHaveBeenCalled();
  });

  test('shows the dialog when the previous one was shown >24h ago', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    showUpdateDialogUI(baseArgs({ lastUpdateDialogShownAt: twoDaysAgo }));
    expect(dialogShow).toHaveBeenCalledTimes(1);
    expect(updateLastDialogShownAt).toHaveBeenCalledTimes(1);
  });

  test('boundary: exactly 24h elapsed → shows the dialog (>= boundary, not >)', () => {
    // The guard reads `now - lastShownAt < INTERVAL`. At exactly INTERVAL the
    // condition is false → dialog shows. Guards against off-by-one drift.
    // Pin Date.now so the test-side timestamp and the production-side `now`
    // read the same value — without this, a slow CI runner can elapse ≥1ms
    // between the two reads and flip the boundary.
    const fixedNow = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    try {
      const exactlyOneDayAgo = fixedNow - UPDATE_DIALOG_INTERVAL;
      showUpdateDialogUI(
        baseArgs({ lastUpdateDialogShownAt: exactlyOneDayAgo }),
      );
      expect(dialogShow).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('boundary: 1ms before 24h → suppresses', () => {
    // See note above — boundary tests must pin Date.now to avoid drift
    // between the test-side timestamp and the production-side `now` read.
    const fixedNow = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    try {
      const justUnderOneDayAgo = fixedNow - (UPDATE_DIALOG_INTERVAL - 1);
      showUpdateDialogUI(
        baseArgs({ lastUpdateDialogShownAt: justUnderOneDayAgo }),
      );
      expect(dialogShow).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('lastUpdateDialogShownAt=0 (uninitialized epoch) is treated as "never shown"', () => {
    // Falsy lastUpdateDialogShownAt skips the throttle gate entirely
    // (the `if (lastUpdateDialogShownAt && ...)` short-circuits on 0).
    // This matters: a freshly-installed app where the field is initialized
    // to 0 should still see the first update dialog.
    showUpdateDialogUI(baseArgs({ lastUpdateDialogShownAt: 0 }));
    expect(dialogShow).toHaveBeenCalledTimes(1);
    expect(updateLastDialogShownAt).toHaveBeenCalledTimes(1);
  });

  test('passes through summary text when provided (not the i18n fallback)', () => {
    showUpdateDialogUI(baseArgs());
    const arg = dialogShow.mock.calls[0][0];
    expect(arg.description).toBe('release notes');
  });

  test('falls back to i18n description when summary is empty', () => {
    showUpdateDialogUI({ ...baseArgs(), summary: '' });
    const arg = dialogShow.mock.calls[0][0];
    // Actual ETranslations key — assert via the formatMessage roundtrip
    // rather than hard-coding so a future i18n key rename only requires
    // updating ETranslations, not this test.
    expect(typeof arg.description).toBe('string');
    expect(arg.description).not.toBe('release notes');
    expect(arg.description.length).toBeGreaterThan(0);
  });

  test('wires onConfirm through to the dialog payload verbatim', () => {
    const onConfirm = jest.fn();
    showUpdateDialogUI({ ...baseArgs(), onConfirm });
    const arg = dialogShow.mock.calls[0][0];
    expect(arg.onConfirm).toBe(onConfirm);
  });
});
