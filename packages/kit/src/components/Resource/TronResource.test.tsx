/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// OK-64027: the home Tron energy / bandwidth card. On an account switch it
// painted 0/0 for the first frames (loading state not started yet), then a
// skeleton, then the values — and every switch paid the full network read
// even for an account it had shown before. The card now keys its cache per
// account: a known account paints its last values at once, an unknown one
// shows the skeleton (never 0/0), and a previous account's figures never
// stand in for the current one.

if (typeof globalThis.requestIdleCallback === 'undefined') {
  (globalThis as any).requestIdleCallback = (cb: () => void) =>
    setTimeout(cb, 0);
  (globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

import type { ReactNode } from 'react';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isWeb: true,
    isRuntimeBrowser: true,
    isRuntimeChrome: false,
  },
}));

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../../components/src/hooks/useDeferredPromise');
  const netInfoModule = require('../../../../components/src/hooks/useNetInfo');
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: netInfoModule.useNetInfo,
    Stack: Box,
    XStack: Box,
    YStack: Box,
    SizableText: Text,
    NumberSizeableText: Text,
    Progress: Box,
    Button: Box,
    Skeleton: () => <div data-testid="tron-resource-skeleton" />,
    Dialog: { show: jest.fn() },
    useDialogInstance: () => ({ close: async () => {} }),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy(
    {},
    { get: (_target, key) => (typeof key === 'string' ? key : '') },
  ),
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: ({ id }: { id: string }) => id } },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlInApp: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountDataUpdate: 'AccountDataUpdate',
    HistoryTxStatusChanged: 'HistoryTxStatusChanged',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../views/Borrow/components/CircleProgress', () => ({
  CircleProgress: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockFetchTronAccountResources = jest.fn<Promise<unknown>, [unknown]>();

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccountProfile: {
      fetchTronAccountResources: (params: unknown) =>
        mockFetchTronAccountResources(params),
    },
  },
}));

import { act, render, screen } from '@testing-library/react';

import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { TronResourceBannerCard } from './TronResource';

/*
yarn jest packages/kit/src/components/Resource/TronResource.test.tsx
*/

const NETWORK_ID = 'tron--0x2b6653dc';
const ACCOUNT_A = 'hd-1--m/44h/195h/0h/0/0';
const ACCOUNT_B = 'hd-1--m/44h/195h/0h/0/1';

// Distinct figures per account so a stale value is unmistakable.
const RESOURCES_A = {
  energyAvailable: '10',
  energyTotal: '20',
  netAvailable: '30',
  netTotal: '40',
};
const RESOURCES_B = {
  energyAvailable: '50',
  energyTotal: '60',
  netAvailable: '70',
  netTotal: '80',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// The first read is scheduled behind a macrotask by usePromiseResult; flush
// it so the request is actually in flight.
async function flushScheduledRead() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

function renderCard(accountId: string) {
  return render(
    <TronResourceBannerCard
      accountId={accountId}
      networkId={NETWORK_ID}
      width={200}
      height={88}
    />,
  );
}

function hasSkeleton() {
  return screen.queryAllByTestId('tron-resource-skeleton').length > 0;
}

function showsResources(resources: typeof RESOURCES_A) {
  return Object.values(resources).every(
    (value) => screen.queryByText(value) !== null,
  );
}

describe('TronResourceBannerCard (OK-64027)', () => {
  beforeEach(() => {
    swrCacheUtils.clearAll();
    mockFetchTronAccountResources.mockReset();
  });

  it('shows the skeleton, never 0/0, until an unknown account resolves', async () => {
    const request = createDeferred<typeof RESOURCES_A>();
    mockFetchTronAccountResources.mockReturnValue(request.promise);

    renderCard(ACCOUNT_A);

    // First frame: the read has not even started yet.
    expect(hasSkeleton()).toBe(true);
    expect(screen.queryByText('0')).toBeNull();

    await flushScheduledRead();
    expect(hasSkeleton()).toBe(true);
    expect(screen.queryByText('0')).toBeNull();

    await act(async () => {
      request.resolve(RESOURCES_A);
      await request.promise;
    });
    expect(hasSkeleton()).toBe(false);
    expect(showsResources(RESOURCES_A)).toBe(true);
  });

  it('paints a known account from its cache before the read lands', async () => {
    swrCacheUtils.set(
      swrKeys.tronAccountResources({
        accountId: ACCOUNT_B,
        networkId: NETWORK_ID,
      }),
      RESOURCES_B,
    );
    mockFetchTronAccountResources.mockReturnValue(
      createDeferred<typeof RESOURCES_B>().promise,
    );

    renderCard(ACCOUNT_B);

    expect(hasSkeleton()).toBe(false);
    expect(showsResources(RESOURCES_B)).toBe(true);

    await flushScheduledRead();
    expect(hasSkeleton()).toBe(false);
    expect(showsResources(RESOURCES_B)).toBe(true);
  });

  it('never shows the previous account while the next one loads', async () => {
    const requestA = createDeferred<typeof RESOURCES_A>();
    const requestB = createDeferred<typeof RESOURCES_B>();
    mockFetchTronAccountResources
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise);

    const { rerender } = renderCard(ACCOUNT_A);
    await flushScheduledRead();
    await act(async () => {
      requestA.resolve(RESOURCES_A);
      await requestA.promise;
    });
    expect(showsResources(RESOURCES_A)).toBe(true);

    rerender(
      <TronResourceBannerCard
        accountId={ACCOUNT_B}
        networkId={NETWORK_ID}
        width={200}
        height={88}
      />,
    );

    // Synchronously on the switch: account A's figures are gone.
    expect(hasSkeleton()).toBe(true);
    expect(showsResources(RESOURCES_A)).toBe(false);

    await flushScheduledRead();
    expect(hasSkeleton()).toBe(true);
    expect(showsResources(RESOURCES_A)).toBe(false);

    await act(async () => {
      requestB.resolve(RESOURCES_B);
      await requestB.promise;
    });
    expect(hasSkeleton()).toBe(false);
    expect(showsResources(RESOURCES_B)).toBe(true);
    expect(showsResources(RESOURCES_A)).toBe(false);
  });

  it('keeps the current account cached values through a silent refresh failure', async () => {
    swrCacheUtils.set(
      swrKeys.tronAccountResources({
        accountId: ACCOUNT_B,
        networkId: NETWORK_ID,
      }),
      RESOURCES_B,
    );
    const request = createDeferred<typeof RESOURCES_B>();
    mockFetchTronAccountResources.mockReturnValue(request.promise);

    renderCard(ACCOUNT_B);
    await flushScheduledRead();

    const error = { autoToast: true, message: 'Request timeout' };
    await act(async () => {
      request.reject(error);
      await request.promise.catch(() => undefined);
    });

    expect(hasSkeleton()).toBe(false);
    expect(showsResources(RESOURCES_B)).toBe(true);
    // The silent card refresh must not surface the proxy error toast.
    expect(error.autoToast).toBe(false);
  });
});
