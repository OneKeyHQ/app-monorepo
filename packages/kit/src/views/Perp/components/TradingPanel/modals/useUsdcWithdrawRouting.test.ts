import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IUsdcWithdrawDestinationId } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useUsdcWithdrawRouting } from './useUsdcWithdrawRouting';

const config: { withdrawChannel?: 'cctp' | 'legacy' } = {};
const settings: { lastUsdcWithdrawDestinationId: IUsdcWithdrawDestinationId } =
  {
    lastUsdcWithdrawDestinationId: 'base',
  };
const getRoute = jest.fn<Promise<'bridge' | 'cctp'>, []>();
let focused = true;
let online = true;
const visibilityListeners = new Set<(visible: boolean) => void>();
const setSettings = jest.fn(
  (update: (current: typeof settings) => typeof settings) => {
    Object.assign(settings, update(settings));
  },
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidExchange: { getUsdcWithdrawRoute: () => getRoute() },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCommonConfigPersistAtom: () => [{ perpConfigCommon: config }],
  usePerpsCustomSettingsAtom: () => [settings, setSettings],
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => focused,
}));
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    visibilityListeners.add(listener);
    return () => visibilityListeners.delete(listener);
  },
  useDeferredPromise: jest.requireActual(
    '../../../../../../../components/src/hooks/useDeferredPromise',
  ).useDeferredPromise,
  useNetInfo: () => ({ isRawInternetReachable: online }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

const onRoutingChange = jest.fn();
const initialProps = { enabled: true, isSubmitting: false, onRoutingChange };

describe('open withdrawal form routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRoute.mockReset().mockResolvedValue('cctp');
    config.withdrawChannel = undefined;
    settings.lastUsdcWithdrawDestinationId = 'base';
    focused = true;
    online = true;
  });

  it.each(['base', 'ethereum', 'hyperevm', 'arbitrum'] as const)(
    'moves an open %s form to Arbitrum and requests a fresh amount confirmation',
    async (destinationId) => {
      settings.lastUsdcWithdrawDestinationId = destinationId;
      const { result, rerender } = renderHook(useUsdcWithdrawRouting, {
        initialProps,
      });
      await waitFor(() => expect(result.current.withdrawRoute).toBe('cctp'));
      config.withdrawChannel = 'legacy';
      rerender(initialProps);
      await waitFor(() => expect(result.current.withdrawRoute).toBe('bridge'));
      expect(result.current.withdrawDestinationId).toBe('arbitrum');
      expect(result.current.withdrawDestinations.map(({ id }) => id)).toEqual([
        'arbitrum',
      ]);
      expect(onRoutingChange).toHaveBeenCalledTimes(1);
      expect(settings.lastUsdcWithdrawDestinationId).toBe('arbitrum');
    },
  );

  it('restores normal destinations without silently restoring the previous chain', async () => {
    config.withdrawChannel = 'legacy';
    getRoute.mockResolvedValue('bridge');
    const { result, rerender } = renderHook(useUsdcWithdrawRouting, {
      initialProps,
    });
    await waitFor(() => expect(getRoute).toHaveBeenCalled());
    config.withdrawChannel = 'cctp';
    getRoute.mockResolvedValue('cctp');
    rerender(initialProps);
    await waitFor(() => expect(result.current.withdrawRoute).toBe('cctp'));
    expect(result.current.withdrawDestinationId).toBe('arbitrum');
    expect(result.current.withdrawDestinations).toHaveLength(6);
    expect(onRoutingChange).toHaveBeenCalledTimes(1);
  });

  it('discards a delayed CCTP result after the emergency switch arrives', async () => {
    let resolveRoute!: (route: 'cctp') => void;
    getRoute.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRoute = resolve;
      }),
    );
    const { result, rerender } = renderHook(useUsdcWithdrawRouting, {
      initialProps,
    });
    config.withdrawChannel = 'legacy';
    rerender(initialProps);
    await act(async () => {
      resolveRoute('cctp');
    });
    expect(result.current.withdrawRoute).toBe('bridge');
    expect(result.current.withdrawDestinations.map(({ id }) => id)).toEqual([
      'arbitrum',
    ]);
  });

  it('keeps signing stable and applies the changed policy after submission finishes', async () => {
    const { result, rerender } = renderHook(useUsdcWithdrawRouting, {
      initialProps,
    });
    await waitFor(() => expect(result.current.withdrawRoute).toBe('cctp'));
    rerender({ ...initialProps, isSubmitting: true });
    config.withdrawChannel = 'legacy';
    rerender({ ...initialProps, isSubmitting: true });
    expect(result.current.withdrawRoute).toBe('cctp');
    expect(result.current.withdrawDestinationId).toBe('base');
    expect(onRoutingChange).not.toHaveBeenCalled();
    rerender(initialProps);
    await waitFor(() => expect(result.current.withdrawRoute).toBe('bridge'));
    expect(onRoutingChange).toHaveBeenCalledTimes(1);
  });

  it('retains the route after a failed refresh and recovers on the next refresh', async () => {
    const { result } = renderHook(useUsdcWithdrawRouting, { initialProps });
    await waitFor(() => expect(result.current.withdrawRoute).toBe('cctp'));
    getRoute.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await expect(
        result.current.refreshWithdrawRoute(),
      ).resolves.toBeUndefined();
    });
    expect(result.current.withdrawRoute).toBe('cctp');
    expect(onRoutingChange).not.toHaveBeenCalled();
    getRoute.mockResolvedValue('bridge');
    await act(async () => {
      await result.current.refreshWithdrawRoute();
    });
    expect(result.current.withdrawRoute).toBe('bridge');
    expect(onRoutingChange).toHaveBeenCalledTimes(1);
  });

  it('refreshes on focus and reconnect', async () => {
    const { rerender } = renderHook(useUsdcWithdrawRouting, { initialProps });
    await waitFor(() => expect(getRoute).toHaveBeenCalledTimes(1));
    focused = false;
    rerender(initialProps);
    focused = true;
    rerender(initialProps);
    await waitFor(() => expect(getRoute).toHaveBeenCalledTimes(2));
    online = false;
    rerender(initialProps);
    online = true;
    rerender(initialProps);
    await waitFor(() => expect(getRoute).toHaveBeenCalledTimes(3));
  });

  it('refreshes immediately when the app becomes visible again', async () => {
    const { unmount } = renderHook(useUsdcWithdrawRouting, { initialProps });
    await waitFor(() => expect(getRoute).toHaveBeenCalledTimes(1));
    await act(async () => {
      visibilityListeners.forEach((listener) => listener(true));
    });
    expect(getRoute).toHaveBeenCalledTimes(2);
    unmount();
    expect(visibilityListeners.size).toBe(0);
  });

  it('refreshes the active form every 30 seconds', async () => {
    jest.useFakeTimers();
    try {
      const { unmount } = renderHook(useUsdcWithdrawRouting, { initialProps });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(getRoute).toHaveBeenCalledTimes(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(30_000);
      });
      expect(getRoute).toHaveBeenCalledTimes(2);
      unmount();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(30_000);
      });
      expect(getRoute).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
