/** @jest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IKytIntroClaimResult } from '@onekeyhq/shared/types/kyt';

import { KYTIntroOnMount } from './KYTIntroDialog';

let mockCurrentUserId = 'user-a';
const mockPrimeAtomListeners = new Set<() => void>();
let mockIsPrimeSubscriptionActive = false;
const mockPrimeSubscriptionListeners = new Set<() => void>();
let mockAppUpdateInfo = { status: 'checking', firstLaunch: false };
type IMockNavigationState = {
  index: number;
  routes: Array<{ name: string; state?: IMockNavigationState }>;
};
let mockRootState: IMockNavigationState = {
  index: 0,
  routes: [
    {
      name: 'main',
      state: { index: 0, routes: [{ name: 'Home' }] },
    },
  ],
};
let mockHasOpenDialog = false;
let mockTabFocusCallback:
  | ((isFocus: boolean, isHiddenByModal: boolean) => void)
  | undefined;
let mockTokensDoneCallback: ((trigger: string) => void) | undefined;

const mockDialogShow = jest.fn();
const mockTryClaim = jest.fn<
  Promise<IKytIntroClaimResult>,
  [
    {
      onekeyUserId: string;
      ownerId: string;
      entryPoint: 'homeAutoIntro' | 'primeSubscribeSuccess';
      claimId?: string;
    },
  ]
>(async ({ entryPoint, claimId }) => ({
  status: 'claimed',
  claimId: claimId ?? 'claim-a',
  entryPoint,
}));
const mockMarkClaimPresented = jest.fn<Promise<boolean>, [unknown]>(
  async () => true,
);
const mockReleaseClaim = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockCompleteClaim = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockSetKytEnabled = jest.fn<
  Promise<{
    applied: boolean;
    accountChanged: boolean;
    onekeyUserId: string;
  }>,
  [{ enabled: boolean; onekeyUserId: string }]
>(async ({ onekeyUserId }) => ({
  applied: true,
  accountChanged: false,
  onekeyUserId,
}));
const mockIntroFlowFailedLog = jest.fn();
const mockPromptNotificationPermission = jest.fn<Promise<void>, [unknown]>(
  async () => undefined,
);
const mockIntroShownLog = jest.fn();
const mockIntroActionLog = jest.fn();
const mockRunAfterTokensDone = jest.fn(
  ({ onRun }: { onRun: (trigger: string) => void }) => {
    mockTokensDoneCallback = onRun;
    return () => undefined;
  },
);

function mockSetCurrentUserId(onekeyUserId: string) {
  mockCurrentUserId = onekeyUserId;
  mockPrimeAtomListeners.forEach((listener) => listener());
}

function mockSetPrimeSubscriptionActive(isActive: boolean) {
  mockIsPrimeSubscriptionActive = isActive;
  mockPrimeSubscriptionListeners.forEach((listener) => listener());
}

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    locale: 'en-US',
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (options: unknown) => {
      mockDialogShow(options);
    },
  },
  Icon: () => null,
  SizableText: () => null,
  XStack: () => null,
  YStack: () => null,
  getDialogInstances: () =>
    mockHasOpenDialog
      ? [
          {
            isExist: () => true,
          },
        ]
      : [],
  rootNavigationRef: {
    current: {
      getRootState: () => mockRootState,
    },
  },
  useMedia: () => ({ md: false }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSetting: {
      apiSetKytEnabled: (params: { enabled: boolean; onekeyUserId: string }) =>
        mockSetKytEnabled(params),
      tryClaimKytIntro: (params: Parameters<typeof mockTryClaim>[0]) =>
        mockTryClaim(params),
      markKytIntroClaimPresented: (params: unknown) =>
        mockMarkClaimPresented(params),
      releaseKytIntroClaim: (params: unknown) => mockReleaseClaim(params),
      completeKytIntroClaim: (params: unknown) => mockCompleteClaim(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuthMethods: () => {
    const React = jest.requireActual('react') as typeof import('react');
    const isPrimeSubscriptionActive = React.useSyncExternalStore(
      (listener) => {
        mockPrimeSubscriptionListeners.add(listener);
        return () => mockPrimeSubscriptionListeners.delete(listener);
      },
      () => mockIsPrimeSubscriptionActive,
      () => mockIsPrimeSubscriptionActive,
    );
    return { isPrimeSubscriptionActive };
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: (
    _tabName: string,
    callback: (isFocus: boolean, isHiddenByModal: boolean) => void,
  ) => {
    mockTabFocusCallback = callback;
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRunAfterTokensDone', () => ({
  runAfterTokensDone: (params: { onRun: (trigger: string) => void }) =>
    mockRunAfterTokensDone(params),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useAppUpdatePersistAtom: () => [mockAppUpdateInfo],
    usePrimePersistAtom: () => {
      const onekeyUserId = React.useSyncExternalStore(
        (listener) => {
          mockPrimeAtomListeners.add(listener);
          return () => mockPrimeAtomListeners.delete(listener);
        },
        () => mockCurrentUserId,
        () => mockCurrentUserId,
      );
      return [{ onekeyUserId }];
    },
  };
});

jest.mock('@onekeyhq/shared/src/appUpdate', () => ({
  EAppUpdateStatus: { done: 'done' },
  isFirstLaunchAfterUpdated: (info: { firstLaunch?: boolean }) =>
    !!info.firstLaunch,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      usage: {
        primeReceiveKytIntroAction: (params: unknown) => {
          mockIntroActionLog(params);
        },
        primeReceiveKytIntroShown: (params: unknown) => {
          mockIntroShownLog(params);
        },
        primeReceiveKytIntroFlowFailed: (params: unknown) => {
          mockIntroFlowFailedLog(params);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('./showKytNotificationPermissionDialog', () => ({
  promptKytNotificationPermissionIfNeeded: (params: unknown) =>
    mockPromptNotificationPermission(params),
}));

type IDialogOptions = {
  onClose: (extra?: { flag?: string }) => void;
  onConfirm: (instance: {
    close: (extra?: { flag?: string }) => Promise<void>;
  }) => Promise<void>;
};

function emitPurchaseSuccess(onekeyUserId = 'user-a', claimId?: string) {
  appEventBus.emitToSelf({
    type: EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
    payload: { onekeyUserId, claimId },
    isRemote: false,
  });
}

describe('KYTIntroOnMount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUserId = 'user-a';
    mockIsPrimeSubscriptionActive = false;
    mockAppUpdateInfo = { status: 'checking', firstLaunch: false };
    mockRootState = {
      index: 0,
      routes: [
        {
          name: 'main',
          state: { index: 0, routes: [{ name: 'Home' }] },
        },
      ],
    };
    mockHasOpenDialog = false;
    mockTabFocusCallback = undefined;
    mockTokensDoneCallback = undefined;
    mockTryClaim.mockImplementation(async ({ entryPoint, claimId }) => ({
      status: 'claimed',
      claimId: claimId ?? 'claim-a',
      entryPoint,
    }));
    mockMarkClaimPresented.mockResolvedValue(true);
    mockSetKytEnabled.mockImplementation(async ({ onekeyUserId: userId }) => ({
      applied: true,
      accountChanged: false,
      onekeyUserId: userId,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup();
    mockPrimeAtomListeners.clear();
    mockPrimeSubscriptionListeners.clear();
  });

  it('shows from purchase success without waiting for Home readiness', async () => {
    mockRootState = {
      index: 0,
      routes: [{ name: 'fullScreenPush' }],
    };
    render(<KYTIntroOnMount />);

    act(() => {
      emitPurchaseSuccess();
    });

    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));
    expect(mockIntroShownLog).toHaveBeenCalledWith(
      expect.objectContaining({ entryPoint: 'primeSubscribeSuccess' }),
    );
  });

  it('keeps the Home fallback behind its existing readiness gates', async () => {
    mockIsPrimeSubscriptionActive = true;
    mockAppUpdateInfo = { status: 'done', firstLaunch: false };
    render(<KYTIntroOnMount />);

    expect(mockRunAfterTokensDone).not.toHaveBeenCalled();

    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    expect(mockRunAfterTokensDone).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).not.toHaveBeenCalled();

    act(() => {
      mockTokensDoneCallback?.('tokensDone');
    });

    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));
    expect(mockIntroShownLog).toHaveBeenCalledWith(
      expect.objectContaining({ entryPoint: 'homeAutoIntro' }),
    );
  });

  it('does not arm the Home cold-start fallback before first Home focus', () => {
    mockIsPrimeSubscriptionActive = true;
    mockAppUpdateInfo = { status: 'done', firstLaunch: false };
    render(<KYTIntroOnMount />);

    act(() => {
      mockTabFocusCallback?.(false, false);
    });
    expect(mockRunAfterTokensDone).not.toHaveBeenCalled();

    act(() => {
      mockTabFocusCallback?.(true, false);
      mockTabFocusCallback?.(false, false);
      mockTabFocusCallback?.(true, false);
    });
    expect(mockRunAfterTokensDone).toHaveBeenCalledTimes(1);
  });

  it('ignores the synthetic Home focus before navigation is initialized', () => {
    mockIsPrimeSubscriptionActive = true;
    mockAppUpdateInfo = { status: 'done', firstLaunch: false };
    mockRootState = { index: 0, routes: [] };
    render(<KYTIntroOnMount />);

    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    expect(mockRunAfterTokensDone).not.toHaveBeenCalled();

    mockRootState = {
      index: 0,
      routes: [
        {
          name: 'main',
          state: { index: 0, routes: [{ name: 'Home' }] },
        },
      ],
    };
    act(() => {
      mockTabFocusCallback?.(true, false);
    });
    expect(mockRunAfterTokensDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the Home fallback when Prime becomes active after mount', async () => {
    mockAppUpdateInfo = { status: 'done', firstLaunch: false };
    render(<KYTIntroOnMount />);

    act(() => {
      mockTabFocusCallback?.(true, false);
      mockTokensDoneCallback?.('tokensDone');
    });
    expect(mockDialogShow).not.toHaveBeenCalled();

    act(() => {
      mockSetPrimeSubscriptionActive(true);
    });

    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));
    expect(mockIntroShownLog).toHaveBeenCalledWith(
      expect.objectContaining({ entryPoint: 'homeAutoIntro' }),
    );
  });

  it('upgrades a racing Home attempt and opens only one dialog', async () => {
    let resolveClaim: ((value: IKytIntroClaimResult) => void) | undefined;
    mockIsPrimeSubscriptionActive = true;
    mockAppUpdateInfo = { status: 'done', firstLaunch: false };
    mockTryClaim.mockImplementationOnce(
      () =>
        new Promise<IKytIntroClaimResult>((resolve) => {
          resolveClaim = resolve;
        }),
    );
    render(<KYTIntroOnMount />);

    act(() => {
      mockTabFocusCallback?.(true, false);
      mockTokensDoneCallback?.('tokensDone');
    });
    await waitFor(() => expect(mockTryClaim).toHaveBeenCalledTimes(1));

    act(() => {
      emitPurchaseSuccess();
      resolveClaim?.({
        status: 'claimed',
        claimId: 'home-claim',
        entryPoint: 'homeAutoIntro',
      });
    });

    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));
    expect(mockTryClaim).toHaveBeenCalledTimes(2);
    expect(mockIntroShownLog).toHaveBeenCalledWith(
      expect.objectContaining({ entryPoint: 'primeSubscribeSuccess' }),
    );
  });

  it.each(['shown', 'enabled'] as const)(
    'skips a purchase prompt when KYT is already %s',
    async (status) => {
      mockTryClaim.mockResolvedValue({ status });
      render(<KYTIntroOnMount />);

      act(() => {
        emitPurchaseSuccess();
      });

      await waitFor(() => expect(mockTryClaim).toHaveBeenCalledTimes(1));
      expect(mockDialogShow).not.toHaveBeenCalled();
    },
  );

  it('drops purchase events for another or newly switched user', async () => {
    let resolveClaim: ((value: IKytIntroClaimResult) => void) | undefined;
    mockTryClaim.mockImplementationOnce(
      () =>
        new Promise<IKytIntroClaimResult>((resolve) => {
          resolveClaim = resolve;
        }),
    );
    render(<KYTIntroOnMount />);

    act(() => {
      emitPurchaseSuccess('user-b');
    });
    expect(mockTryClaim).not.toHaveBeenCalled();

    act(() => {
      emitPurchaseSuccess('user-a');
    });
    await waitFor(() => expect(mockTryClaim).toHaveBeenCalledTimes(1));

    act(() => {
      mockSetCurrentUserId('user-b');
      resolveClaim?.({
        status: 'claimed',
        claimId: 'claim-a',
        entryPoint: 'primeSubscribeSuccess',
      });
    });

    await act(async () => Promise.resolve());
    expect(mockMarkClaimPresented).not.toHaveBeenCalled();
    expect(mockReleaseClaim).toHaveBeenCalled();
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('shares enable, notification, persistence, and in-memory dedupe logic', async () => {
    render(<KYTIntroOnMount />);
    act(() => {
      emitPurchaseSuccess();
    });
    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));

    const options = mockDialogShow.mock.calls[0][0] as IDialogOptions;
    const close = jest.fn(async () => undefined);
    await act(async () => {
      await options.onConfirm({ close });
    });
    expect(mockSetKytEnabled).toHaveBeenCalledWith({
      enabled: true,
      onekeyUserId: 'user-a',
    });
    expect(close).toHaveBeenCalledWith({ flag: 'confirm' });
    expect(mockPromptNotificationPermission).toHaveBeenCalledTimes(1);

    act(() => {
      options.onClose({ flag: 'confirm' });
      emitPurchaseSuccess();
    });
    expect(mockCompleteClaim).toHaveBeenCalledWith({
      onekeyUserId: 'user-a',
    });
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  it('does not log an account switch as a user dismissal', async () => {
    render(<KYTIntroOnMount />);
    act(() => {
      emitPurchaseSuccess();
    });
    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));

    const options = mockDialogShow.mock.calls[0][0] as IDialogOptions;
    const close = jest.fn(async () => undefined);
    act(() => {
      mockSetCurrentUserId('user-b');
    });
    await act(async () => {
      await options.onConfirm({ close });
    });
    expect(close).toHaveBeenCalledWith({ flag: 'accountChanged' });
    expect(mockSetKytEnabled).not.toHaveBeenCalled();

    act(() => {
      options.onClose({ flag: 'accountChanged' });
    });
    expect(mockCompleteClaim).toHaveBeenCalledWith({
      onekeyUserId: 'user-a',
    });
    expect(mockIntroActionLog).not.toHaveBeenCalled();
  });

  it('retries a rejected eligibility claim without an unhandled rejection', async () => {
    jest.useFakeTimers();
    mockTryClaim.mockRejectedValueOnce(new Error('bridge unavailable'));
    render(<KYTIntroOnMount />);

    act(() => {
      emitPurchaseSuccess();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockIntroFlowFailedLog).toHaveBeenCalledWith({
      stage: 'eligibility',
      errorMessage: 'bridge unavailable',
    });
    expect(mockDialogShow).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(mockTryClaim).toHaveBeenCalledTimes(2);
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('stops after enable when the Prime user changes during the request', async () => {
    let resolveEnable:
      | ((value: {
          applied: boolean;
          accountChanged: boolean;
          onekeyUserId: string;
        }) => void)
      | undefined;
    mockSetKytEnabled.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEnable = resolve;
        }),
    );
    render(<KYTIntroOnMount />);
    act(() => {
      emitPurchaseSuccess();
    });
    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));

    const options = mockDialogShow.mock.calls[0][0] as IDialogOptions;
    const close = jest.fn(async () => undefined);
    let confirmPromise: Promise<void> | undefined;
    await act(async () => {
      confirmPromise = options.onConfirm({ close });
      await Promise.resolve();
    });
    act(() => {
      mockSetCurrentUserId('user-b');
      resolveEnable?.({
        applied: true,
        accountChanged: true,
        onekeyUserId: 'user-a',
      });
    });
    await act(async () => {
      await confirmPromise;
    });

    expect(close).toHaveBeenCalledWith({ flag: 'accountChanged' });
    expect(mockPromptNotificationPermission).not.toHaveBeenCalled();
  });

  it('persists a normal dismissal and does not show again after remount', async () => {
    const firstRender = render(<KYTIntroOnMount />);
    act(() => {
      emitPurchaseSuccess();
    });
    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));

    const options = mockDialogShow.mock.calls[0][0] as IDialogOptions;
    act(() => {
      options.onClose();
    });
    expect(mockCompleteClaim).toHaveBeenCalledWith({
      onekeyUserId: 'user-a',
    });
    expect(mockIntroActionLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dismiss' }),
    );

    firstRender.unmount();
    mockTryClaim.mockResolvedValue({ status: 'shown' });
    render(<KYTIntroOnMount />);
    act(() => {
      emitPurchaseSuccess();
    });
    await act(async () => Promise.resolve());

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });
});
