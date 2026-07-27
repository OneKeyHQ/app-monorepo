/** @jest-environment jsdom */

import { useLayoutEffect } from 'react';

import { act, render } from '@testing-library/react';

import {
  ProviderJotaiContextHome,
  useHomeContextStore,
  useHomeResource,
  useHomeSessionState,
  useHomeShell,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';

import { loadPreparedHomeDisplaySnapshot } from '../cacheV2/loadPreparedHomeDisplaySnapshot';

import { HomeStoreRuntime } from './homeRuntimeLease';

import type { IPreparedHomeDisplaySnapshot } from '../cacheV2/loadPreparedHomeDisplaySnapshot.types';

const mockCancelSourceSession = jest.fn();

jest.mock('../cacheV2/loadPreparedHomeDisplaySnapshot', () => ({
  loadPreparedHomeDisplaySnapshot: jest.fn(),
}));

jest.mock('../cacheV2/homeDisplaySnapshotPersistQueue', () => ({
  homeDisplaySnapshotPersistQueue: {
    enqueue: jest.fn(),
    flushAndCompact: jest.fn(async () => undefined),
    flushNow: jest.fn(async () => undefined),
  },
}));

jest.mock('../cacheV2/homeSnapshotLoader', () => ({
  loadHomeSnapshotSource: jest.fn(),
}));

jest.mock('../persistence/homePersistenceRuntime', () => ({
  HomePersistenceRuntime: jest.fn(() => ({
    dispose: jest.fn(),
    onStoreCommit: jest.fn(),
  })),
}));

jest.mock('../sources/homeSourceRuntime', () => ({
  HomeSourceRuntime: jest.fn(() => ({
    cancelSession: mockCancelSourceSession,
    dispose: jest.fn(),
  })),
}));

type IProbe = {
  frames: Array<{
    bannerKind: string;
    sessionId?: string;
    shellKind: string;
  }>;
  store?: IJotaiContextStore;
};

function Probe({ probe }: { probe: IProbe }) {
  const store = useHomeContextStore();
  const session = useHomeSessionState();
  const banner = useHomeResource('banner');
  const shell = useHomeShell();
  probe.frames.push({
    bannerKind: banner.kind,
    sessionId: session.ownerToken?.sessionId,
    shellKind: shell.value.kind,
  });
  useLayoutEffect(() => {
    probe.store = store;
  }, [probe, store]);
  return null;
}

describe('HomeStoreRuntime prepared owner transition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('installs a synchronous cache hit in the owner replacement commit', () => {
    const prepared = {
      context: {},
      navigation: {
        kind: 'ready',
        selectedTabId: 'portfolio',
        tabs: ['portfolio'],
      },
      records: [
        {
          sourceId: 'banner',
          sourceKeyIdentity: 'banner-a',
          dataSchemaVersion: 1,
          coverageFingerprint: 'banner-a',
          quoteBasis: null,
          confirmedAt: 1,
          expiresAt: 2,
          payload: {
            banners: [],
            referralEligibility: null,
            tronResource: {
              accountId: 'account-a',
              networkId: 'network-a',
            },
            isBotWalletReceiveBlocked: false,
          },
        },
      ],
      shell: {
        kind: 'portfolio',
        presentation: {
          kind: 'funded',
          header: {
            kind: 'funded',
            authority: 'confirmedCache',
            balance: { amount: '42', currency: 'USD' },
          },
          actions: {
            kind: 'funded',
            items: ['send', 'receive', 'buySell', 'swap'],
          },
          banner: { kind: 'positive' },
          freshness: 'confirmedCache',
          refresh: 'refreshing',
        },
      },
    } as unknown as IPreparedHomeDisplaySnapshot;
    jest
      .mocked(loadPreparedHomeDisplaySnapshot)
      .mockReturnValue(prepared as never);
    const probe: IProbe = { frames: [] };
    render(
      <ProviderJotaiContextHome>
        <Probe probe={probe} />
      </ProviderJotaiContextHome>,
    );
    expect(probe.store).toBeDefined();
    const runtime = new HomeStoreRuntime(probe.store as IJotaiContextStore, {
      mode: 'wallet',
    });
    act(() => {
      runtime.dispatch({
        type: 'runtimeAcquired',
        mode: 'wallet',
        runtimeInstanceId: runtime.identity.runtimeInstanceId,
        clientInstanceId: runtime.identity.clientInstanceId,
        appEpoch: runtime.identity.runtimeInstanceId,
        topology: 'split',
      });
    });

    act(() => {
      runtime.replaceOwner({
        walletId: 'wallet-a',
        accountId: 'account-a',
        network: { kind: 'singleNetwork', networkId: 'network-a' },
      });
    });

    const state = runtime.getState();
    const targetFrames = probe.frames.filter(
      (frame) => frame.sessionId === state.session.ownerToken?.sessionId,
    );
    expect(loadPreparedHomeDisplaySnapshot).toHaveBeenCalledTimes(1);
    expect(state.commitIdentity).toMatchObject({
      origin: 'cacheHydrate',
      ownerChanged: true,
    });
    expect(state.resources.banner).toMatchObject({
      kind: 'ready',
      freshness: 'confirmedCache',
    });
    expect(targetFrames).toHaveLength(1);
    expect(targetFrames[0]).toMatchObject({
      bannerKind: 'ready',
      shellKind: 'portfolio',
    });
    runtime.dispose();
  });

  it('does not read the wallet display cache for URL Account mode', () => {
    const probe: IProbe = { frames: [] };
    render(
      <ProviderJotaiContextHome>
        <Probe probe={probe} />
      </ProviderJotaiContextHome>,
    );
    const runtime = new HomeStoreRuntime(probe.store as IJotaiContextStore, {
      mode: 'urlAccount',
    });
    act(() => {
      runtime.dispatch({
        type: 'runtimeAcquired',
        mode: 'urlAccount',
        runtimeInstanceId: runtime.identity.runtimeInstanceId,
        clientInstanceId: runtime.identity.clientInstanceId,
        appEpoch: runtime.identity.runtimeInstanceId,
        topology: 'single',
      });
      runtime.replaceOwner({
        walletId: 'url-account',
        accountId: 'url-account',
        network: { kind: 'singleNetwork', networkId: 'network-a' },
      });
    });

    expect(loadPreparedHomeDisplaySnapshot).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it('cancels the previous session before preparing the next owner', () => {
    jest
      .mocked(loadPreparedHomeDisplaySnapshot)
      .mockReturnValue(undefined as never);
    const probe: IProbe = { frames: [] };
    render(
      <ProviderJotaiContextHome>
        <Probe probe={probe} />
      </ProviderJotaiContextHome>,
    );
    const runtime = new HomeStoreRuntime(probe.store as IJotaiContextStore, {
      mode: 'wallet',
    });
    act(() => {
      runtime.dispatch({
        type: 'runtimeAcquired',
        mode: 'wallet',
        runtimeInstanceId: runtime.identity.runtimeInstanceId,
        clientInstanceId: runtime.identity.clientInstanceId,
        appEpoch: runtime.identity.runtimeInstanceId,
        topology: 'split',
      });
      runtime.replaceOwner({
        walletId: 'wallet-a',
        accountId: 'account-a',
        network: { kind: 'allNetworks' },
      });
    });
    mockCancelSourceSession.mockClear();
    jest.mocked(loadPreparedHomeDisplaySnapshot).mockClear();

    act(() => {
      runtime.replaceOwner({
        walletId: 'wallet-b',
        accountId: 'account-b',
        network: { kind: 'allNetworks' },
      });
    });

    expect(mockCancelSourceSession).toHaveBeenCalled();
    expect(loadPreparedHomeDisplaySnapshot).toHaveBeenCalledTimes(1);
    expect(mockCancelSourceSession.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(loadPreparedHomeDisplaySnapshot).mock.invocationCallOrder[0],
    );
    runtime.dispose();
  });
});
