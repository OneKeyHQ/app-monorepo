/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { ELaunchOptionsLaunchType } from '@onekeyhq/shared/src/modules/LaunchOptionsManager/type';

import {
  reduceColdStart,
  useNativeColdStart,
} from './coldStartOnboardingState';

const mockGetInitialURL = jest.fn<Promise<string | null>, []>();
const mockGetLaunchOptions = jest.fn<Promise<unknown>, []>();
const mockReadWallet = jest.fn<
  'has_wallet' | 'no_wallet' | 'unknown' | undefined,
  []
>();
const mockIsFreshInstallSync = jest.fn<boolean, []>();
const mockIsSupportedColdStartDeepLinkUrl = jest.fn<boolean, [string]>();
let mockLocked = false;
let mockTravel = false;
let mockForceUpdate = false;

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
  getLinkingURL: () => null,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockLocked],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/appUpdate', () => ({
  useAppUpdatePersistAtom: () => [
    { updateStrategy: mockForceUpdate ? 'force' : 'manual', status: 'notify' },
  ],
}));
jest.mock('@onekeyhq/shared/src/appUpdate', () => ({
  EUpdateStrategy: { force: 'force' },
  EAppUpdateStatus: { done: 'done' },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockTravel ? 'travel-mode' : 'standard' },
    }),
  },
}));
jest.mock('@onekeyhq/shared/src/modules/LaunchOptionsManager', () => ({
  __esModule: true,
  default: { getLaunchOptions: () => mockGetLaunchOptions() },
}));
jest.mock('@onekeyhq/shared/src/utils/freshInstallDetector', () => ({
  isFreshInstallSync: () => mockIsFreshInstallSync(),
}));
jest.mock('@onekeyhq/shared/src/utils/walletPresenceHintUtils', () => ({
  readWalletPresenceHintSync: () => mockReadWallet(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: false },
}));
jest.mock('./deeplink', () => ({
  isSupportedColdStartDeepLinkUrl: (url: string) =>
    mockIsSupportedColdStartDeepLinkUrl(url),
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockLocked = false;
  mockTravel = false;
  mockForceUpdate = false;
  mockGetInitialURL.mockResolvedValue(null);
  mockGetLaunchOptions.mockResolvedValue(null);
  mockReadWallet.mockReturnValue('no_wallet');
  mockIsFreshInstallSync.mockReturnValue(false);
  mockIsSupportedColdStartDeepLinkUrl.mockImplementation(
    (url) =>
      url === 'onekey-wallet://market_detail?coinGeckoId=bitcoin' ||
      url === 'https://app.onekey.so/market',
  );
});

it.each([
  [
    'locked',
    () => {
      mockLocked = true;
    },
  ],
  [
    'travel-mode',
    () => {
      mockTravel = true;
    },
  ],
  [
    'forced-update',
    () => {
      mockForceUpdate = true;
    },
  ],
] as const)('does not probe wallet presence for %s', (entry, setup) => {
  setup();
  const { result } = renderHook(() => useNativeColdStart(false));
  expect(result.current.state).toEqual({ phase: 'ready', entry });
  expect(mockGetInitialURL).not.toHaveBeenCalled();
  expect(mockReadWallet).not.toHaveBeenCalled();
});

it('hands off a launch intent without a wallet probe', async () => {
  mockGetInitialURL.mockResolvedValue('https://app.onekey.so/market');
  const { result } = renderHook(() => useNativeColdStart(false));
  await waitFor(() =>
    expect(result.current.state).toEqual({
      phase: 'ready',
      entry: 'launch-intent',
    }),
  );
  expect(mockReadWallet).not.toHaveBeenCalled();
});

it('falls back to ordinary startup for an unrecognized cold link', async () => {
  mockGetInitialURL.mockResolvedValue('onekey-wallet://unknown');
  const { result } = renderHook(() => useNativeColdStart(false));
  await waitFor(() =>
    expect(result.current.state).toEqual({ phase: 'waiting-for-onboarding' }),
  );
});

it('resumes the legacy wallet check after unlock when no launch intent is pending', async () => {
  jest.useFakeTimers();
  try {
    mockLocked = true;
    const { result, rerender } = renderHook(() => useNativeColdStart(false));
    expect(result.current.state).toEqual({ phase: 'ready', entry: 'locked' });

    mockLocked = false;
    rerender();
    await act(async () => jest.advanceTimersByTimeAsync(250));
    expect(result.current.state).toEqual({
      phase: 'ready',
      entry: 'wallet',
      lateOrdinaryLaunch: true,
    });
  } finally {
    jest.useRealTimers();
  }
});

it('keeps locked state after unlock when a launch intent is pending', async () => {
  jest.useFakeTimers();
  try {
    mockLocked = true;
    mockGetInitialURL.mockResolvedValue('https://app.onekey.so/market');
    const { result, rerender } = renderHook(() => useNativeColdStart(false));
    expect(result.current.state).toEqual({ phase: 'ready', entry: 'locked' });

    mockLocked = false;
    rerender();
    await act(async () => jest.advanceTimersByTimeAsync(250));
    expect(result.current.state).toEqual({ phase: 'ready', entry: 'locked' });
  } finally {
    jest.useRealTimers();
  }
});

it.each(['has_wallet', 'unknown', undefined] as const)(
  'starts at Wallet with an existing or missing hint (%s)',
  async (hint) => {
    mockReadWallet.mockReturnValue(hint);
    const { result } = renderHook(() => useNativeColdStart(false));
    await waitFor(() =>
      expect(result.current.state).toEqual({ phase: 'ready', entry: 'wallet' }),
    );
    expect(mockIsFreshInstallSync).toHaveBeenCalledTimes(
      hint === undefined ? 1 : 0,
    );
  },
);

it.each([
  ELaunchOptionsLaunchType.localNotification,
  ELaunchOptionsLaunchType.remoteNotification,
])(
  'recognizes native %s metadata without a notification payload',
  async (launchType) => {
    mockGetLaunchOptions.mockResolvedValue({ launchType });
    const { result } = renderHook(() => useNativeColdStart(false));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        phase: 'ready',
        entry: 'launch-intent',
      }),
    );
    expect(mockReadWallet).not.toHaveBeenCalled();
  },
);

it('does not claim a rejected Market widget URL', async () => {
  mockGetInitialURL.mockResolvedValue(
    'onekey-wallet://market_widget_config?kind=unsupported',
  );
  const { result } = renderHook(() => useNativeColdStart(false));
  await waitFor(() =>
    expect(result.current.state).toEqual({ phase: 'waiting-for-onboarding' }),
  );
});

it('allows fresh-install evidence in the absence of a wallet hint', async () => {
  mockReadWallet.mockReturnValue(undefined);
  mockIsFreshInstallSync.mockReturnValue(true);
  const { result } = renderHook(() => useNativeColdStart(false));
  await waitFor(() =>
    expect(result.current.state).toEqual({ phase: 'waiting-for-onboarding' }),
  );
});

it('awaits the onboarding layout for an ordinary empty launch', async () => {
  const { result } = renderHook(() => useNativeColdStart(false));
  await waitFor(() =>
    expect(result.current.state).toEqual({ phase: 'waiting-for-onboarding' }),
  );
  act(() => result.current.dispatch({ type: 'onboarding-ready' }));
  expect(result.current.state).toEqual({ phase: 'ready', entry: 'onboarding' });
});

it('cannot reopen a launch once superseded', () => {
  const state = reduceColdStart(
    { phase: 'waiting-for-onboarding' },
    { type: 'interrupted', entry: 'launch-intent' },
  );
  expect(reduceColdStart(state, { type: 'onboarding-ready' })).toBe(state);
  expect(
    reduceColdStart(state, {
      type: 'entry-resolved',
      entry: 'onboarding',
    }),
  ).toBe(state);
});

it('releases Splash at 300ms and permits a late ordinary Wallet check', async () => {
  jest.useFakeTimers();
  try {
    let resolveUrl: (url: string | null) => void = () => undefined;
    mockGetInitialURL.mockReturnValue(
      new Promise((resolve) => {
        resolveUrl = resolve;
      }),
    );
    const { result } = renderHook(() => useNativeColdStart(false));
    expect(result.current.state).toEqual({ phase: 'resolving' });
    act(() => jest.advanceTimersByTime(300));
    expect(result.current.state).toEqual({
      phase: 'ready',
      entry: 'unknown-entry',
    });
    await act(async () => resolveUrl(null));
    expect(result.current.state).toEqual({
      phase: 'ready',
      entry: 'wallet',
      lateOrdinaryLaunch: true,
    });
    expect(mockReadWallet).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
