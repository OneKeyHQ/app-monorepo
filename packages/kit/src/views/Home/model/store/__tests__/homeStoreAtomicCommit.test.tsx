/** @jest-environment jsdom */

import { type ReactNode, useLayoutEffect, useMemo } from 'react';

import { act, render } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextHome,
  useHomeCommitIdentity,
  useHomeResource,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  dispatchHomeStoreEventsAtomically,
  dispatchHomeStoreEventsTransaction,
  useHomeStoreInternalActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import {
  homeCommitIdentityState,
  homeHeaderPresentationState,
  homeSessionState,
  homeShellState,
  resourceStates,
  sectionStates,
} from '@onekeyhq/kit/src/states/jotai/contexts/home/atoms';

import type { IHomeStoreState } from '../homeStoreTypes';

type IProbe = {
  dispatch?: ReturnType<
    typeof useHomeStoreInternalActions
  >['current']['dispatchHomeEvent'];
  dispatchBatch?: ReturnType<
    typeof useHomeStoreInternalActions
  >['current']['dispatchHomeEventsAtomically'];
  read?: ReturnType<
    typeof useHomeStoreInternalActions
  >['current']['readHomeStoreSnapshot'];
  renders: number;
  session?: IHomeStoreState['session'];
  commit?: IHomeStoreState['commitIdentity'];
  snapshots: IHomeStoreState[];
};

function Probe({ probe }: { probe: IProbe }) {
  const actions = useHomeStoreInternalActions().current;
  const session = useHomeSessionState();
  const commit = useHomeCommitIdentity();
  probe.renders += 1;
  probe.session = session;
  probe.commit = commit;
  useLayoutEffect(() => {
    probe.dispatch = actions.dispatchHomeEvent;
    probe.dispatchBatch = actions.dispatchHomeEventsAtomically;
    probe.read = actions.readHomeStoreSnapshot;
    probe.snapshots.push(actions.readHomeStoreSnapshot());
  }, [actions, commit, probe, session]);
  return null;
}

function ResourceRenderProbe({
  renders,
  sourceId,
}: {
  renders: { value: number };
  sourceId: 'banner' | 'portfolio';
}) {
  useHomeResource(sourceId);
  renders.value += 1;
  return null;
}

function Scene({
  children,
  sceneId,
}: {
  children?: ReactNode;
  sceneId: string;
}) {
  const config = useMemo(() => ({ sceneId }), [sceneId]);
  return (
    <ProviderJotaiContextHome config={config}>
      {children}
    </ProviderJotaiContextHome>
  );
}

describe('Home Store atomic dispatcher', () => {
  it('increments Store commit identity once for one mutating event', () => {
    const probe: IProbe = { renders: 0, snapshots: [] };
    render(
      <Scene sceneId="wallet-home">
        <Probe probe={probe} />
      </Scene>,
    );
    act(() => {
      probe.dispatch?.({
        type: 'ownerChanged',
        owner: {
          walletId: 'wallet-a',
          accountId: 'account-a',
          network: { kind: 'allNetworks' },
        },
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
        topology: 'single',
      });
    });
    expect(probe.read?.().commitIdentity.storeCommitId).toBe(1);
    expect(probe.read?.().session.ownerToken?.sessionId).toBe('session-a');
  });

  it('publishes a replacement owner and prepared display cache in one commit', () => {
    const probe: IProbe = { renders: 0, snapshots: [] };
    render(
      <Scene sceneId="wallet-home">
        <Probe probe={probe} />
      </Scene>,
    );
    act(() => {
      probe.dispatchBatch?.({
        displaySnapshotLoadState: {
          ownerScopeKey: 'owner-b',
          sessionId: 'session-b',
          status: 'hit',
        },
        events: [
          {
            type: 'ownerChanged',
            owner: {
              walletId: 'wallet-b',
              accountId: 'account-b',
              network: { kind: 'allNetworks' },
            },
            ownerToken: { scopeKey: 'owner-b', sessionId: 'session-b' },
            topology: 'split',
          },
          {
            type: 'displaySnapshotHydrated',
            ownerScopeKey: 'owner-b',
            sessionId: 'session-b',
            records: [],
            shell: {
              kind: 'portfolio',
              presentation: {
                kind: 'funded',
                header: {
                  kind: 'funded',
                  authority: 'confirmedCache',
                  balance: { amount: '42.50', currency: 'usd' },
                },
                actions: {
                  kind: 'funded',
                  items: ['send', 'receive', 'buySell', 'swap'],
                },
                banner: { kind: 'none' },
                freshness: 'confirmedCache',
                refresh: 'refreshing',
              },
            },
          },
        ],
      });
    });

    const snapshot = probe.read?.();
    expect(snapshot?.commitIdentity.storeCommitId).toBe(1);
    expect(snapshot?.commitIdentity).toMatchObject({
      origin: 'cacheHydrate',
      ownerChanged: true,
    });
    expect(snapshot?.session.ownerToken).toEqual({
      scopeKey: 'owner-b',
      sessionId: 'session-b',
    });
    expect(snapshot?.shell.value).toMatchObject({
      kind: 'portfolio',
      presentation: {
        header: { balance: { amount: '42.50', currency: 'usd' } },
      },
    });
  });

  it('publishes the replacement owner and its account presentation atomically', () => {
    const store = createStore();
    const observedFrames: Array<{
      accountName: string;
      sessionId?: string;
    }> = [];
    const unsubscribe = store.sub(homeSessionState.atom(), () => {
      observedFrames.push({
        accountName: store.get(homeHeaderPresentationState.atom()).account
          .accountName,
        sessionId: store.get(homeSessionState.atom()).ownerToken?.sessionId,
      });
    });

    dispatchHomeStoreEventsTransaction.call(store.set, {
      events: [
        {
          type: 'ownerChanged',
          owner: {
            walletId: 'wallet-header',
            accountId: 'account-header',
            network: { kind: 'allNetworks' },
          },
          ownerToken: {
            scopeKey: 'owner-header',
            sessionId: 'session-header',
          },
          headerAccountPresentation: {
            accountName: 'Account Header',
            compatibleNetworks: [],
            compatibleNetworksReady: true,
            compatibleNetworksWithoutAccountCount: 0,
            copyDisabled: false,
            isAccountSelectorSyncLoading: false,
            isAllNetworks: true,
            isOthersWallet: false,
            ready: true,
          },
          topology: 'split',
        },
      ],
    });
    unsubscribe();

    expect(observedFrames).toEqual([
      {
        accountName: 'Account Header',
        sessionId: 'session-header',
      },
    ]);
    expect(
      store.get(homeHeaderPresentationState.atom()).accountPresentationRevision,
    ).toBe(1);
  });

  it('rejects stale account presentation updates without replacing the view model', () => {
    const store = createStore();
    const ownerToken = {
      scopeKey: 'owner-current',
      sessionId: 'session-current',
    };
    dispatchHomeStoreEventsAtomically(store.get, store.set, {
      events: [
        {
          type: 'ownerChanged',
          owner: {
            walletId: 'wallet-current',
            accountId: 'account-current',
            network: { kind: 'allNetworks' },
          },
          ownerToken,
          headerAccountPresentation: {
            accountName: 'Current Account',
            compatibleNetworks: [],
            compatibleNetworksReady: false,
            compatibleNetworksWithoutAccountCount: 0,
            copyDisabled: false,
            isAccountSelectorSyncLoading: false,
            isAllNetworks: true,
            isOthersWallet: false,
            ready: true,
          },
          topology: 'split',
        },
      ],
    });
    const commitId = store.get(homeCommitIdentityState.atom()).storeCommitId;
    const effects = dispatchHomeStoreEventsAtomically(store.get, store.set, {
      events: [
        {
          type: 'headerAccountPresentationChanged',
          ownerToken: {
            scopeKey: 'owner-stale',
            sessionId: 'session-stale',
          },
          presentation: {
            accountName: 'Stale Account',
            compatibleNetworks: [],
            compatibleNetworksReady: true,
            compatibleNetworksWithoutAccountCount: 0,
            copyDisabled: false,
            isAccountSelectorSyncLoading: false,
            isAllNetworks: true,
            isOthersWallet: false,
            ready: true,
          },
        },
      ],
    });

    expect(effects).toEqual([
      expect.objectContaining({
        kind: 'traceReject',
        reason: 'ownerMismatch',
      }),
    ]);
    expect(
      store.get(homeHeaderPresentationState.atom()).account.accountName,
    ).toBe('Current Account');
    expect(store.get(homeCommitIdentityState.atom()).storeCommitId).toBe(
      commitId + 1,
    );
  });

  it('does not publish an unchanged account presentation', () => {
    const store = createStore();
    const ownerToken = {
      scopeKey: 'owner-stable',
      sessionId: 'session-stable',
    };
    const presentation = {
      accountName: 'Stable Account',
      compatibleNetworks: [],
      compatibleNetworksReady: true,
      compatibleNetworksWithoutAccountCount: 0,
      copyDisabled: false,
      isAccountSelectorSyncLoading: false,
      isAllNetworks: true,
      isOthersWallet: false,
      ready: true,
    };
    dispatchHomeStoreEventsAtomically(store.get, store.set, {
      events: [
        {
          type: 'ownerChanged',
          owner: {
            walletId: 'wallet-stable',
            accountId: 'account-stable',
            network: { kind: 'allNetworks' },
          },
          ownerToken,
          headerAccountPresentation: presentation,
          topology: 'split',
        },
      ],
    });
    const commitId = store.get(homeCommitIdentityState.atom()).storeCommitId;

    dispatchHomeStoreEventsAtomically(store.get, store.set, {
      events: [
        {
          type: 'headerAccountPresentationChanged',
          ownerToken,
          presentation,
        },
      ],
    });

    expect(store.get(homeCommitIdentityState.atom()).storeCommitId).toBe(
      commitId,
    );
    expect(
      store.get(homeHeaderPresentationState.atom()).accountPresentationRevision,
    ).toBe(1);
  });

  it('publishes external runtime dispatches as one Jotai transaction', () => {
    const store = createStore();
    const observedFrames: Array<{
      sessionId?: string;
      shellKind: IHomeStoreState['shell']['value']['kind'];
    }> = [];
    const unsubscribe = store.sub(homeSessionState.atom(), () => {
      observedFrames.push({
        sessionId: store.get(homeSessionState.atom()).ownerToken?.sessionId,
        shellKind: store.get(homeShellState.atom()).value.kind,
      });
    });

    dispatchHomeStoreEventsTransaction.call(store.set, {
      displaySnapshotLoadState: {
        ownerScopeKey: 'owner-runtime',
        sessionId: 'session-runtime',
        status: 'hit',
      },
      events: [
        {
          type: 'ownerChanged',
          owner: {
            walletId: 'wallet-runtime',
            accountId: 'account-runtime',
            network: { kind: 'allNetworks' },
          },
          ownerToken: {
            scopeKey: 'owner-runtime',
            sessionId: 'session-runtime',
          },
          topology: 'split',
        },
        {
          type: 'displaySnapshotHydrated',
          ownerScopeKey: 'owner-runtime',
          sessionId: 'session-runtime',
          records: [],
          shell: {
            kind: 'portfolio',
            presentation: {
              kind: 'funded',
              header: {
                kind: 'funded',
                authority: 'confirmedCache',
                balance: { amount: '42.50', currency: 'usd' },
              },
              actions: {
                kind: 'funded',
                items: ['send', 'receive', 'buySell', 'swap'],
              },
              banner: { kind: 'none' },
              freshness: 'confirmedCache',
              refresh: 'refreshing',
            },
          },
        },
      ],
    });
    unsubscribe();

    expect(observedFrames).toEqual([
      {
        sessionId: 'session-runtime',
        shellKind: 'portfolio',
      },
    ]);
  });

  it('preserves the same Store session and commit across parent rerenders', () => {
    const probe: IProbe = { renders: 0, snapshots: [] };
    const view = render(
      <Scene sceneId="wallet-home">
        <Probe probe={probe} />
      </Scene>,
    );
    act(() => {
      probe.dispatch?.({
        type: 'ownerChanged',
        owner: {
          walletId: 'wallet-a',
          accountId: 'account-a',
          network: { kind: 'allNetworks' },
        },
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
        topology: 'single',
      });
    });
    const session = probe.session;
    const commit = probe.commit;

    view.rerender(
      <Scene sceneId="wallet-home">
        <Probe probe={probe} />
      </Scene>,
    );

    expect(probe.session).toBe(session);
    expect(probe.commit).toBe(commit);
    expect(probe.session?.ownerToken?.sessionId).toBe('session-a');
    expect(probe.commit?.storeCommitId).toBe(1);
  });

  it('keeps concurrent Home scenes isolated', () => {
    const walletProbe: IProbe = { renders: 0, snapshots: [] };
    const urlProbe: IProbe = { renders: 0, snapshots: [] };
    render(
      <>
        <Scene sceneId="wallet-home">
          <Probe probe={walletProbe} />
        </Scene>
        <Scene sceneId="url-account-home">
          <Probe probe={urlProbe} />
        </Scene>
      </>,
    );
    act(() => {
      walletProbe.dispatch?.({
        type: 'ownerChanged',
        owner: {
          walletId: 'wallet-a',
          accountId: 'account-a',
          network: { kind: 'allNetworks' },
        },
        ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
        topology: 'single',
      });
    });
    expect(walletProbe.read?.().session.ownerToken?.scopeKey).toBe('owner-a');
    expect(urlProbe.read?.().session.ownerToken).toBeUndefined();
    expect(urlProbe.read?.().commitIdentity.storeCommitId).toBe(0);
  });

  it('rerenders only subscribers of the resource changed by a local event', () => {
    const probe: IProbe = { renders: 0, snapshots: [] };
    const bannerRenders = { value: 0 };
    const portfolioRenders = { value: 0 };
    render(
      <Scene sceneId="wallet-home">
        <Probe probe={probe} />
        <ResourceRenderProbe renders={bannerRenders} sourceId="banner" />
        <ResourceRenderProbe renders={portfolioRenders} sourceId="portfolio" />
      </Scene>,
    );
    const ownerToken = { scopeKey: 'owner-local', sessionId: 'session-local' };
    act(() => {
      probe.dispatch?.({
        type: 'ownerChanged',
        owner: {
          walletId: 'wallet-local',
          accountId: 'account-local',
          network: { kind: 'allNetworks' },
        },
        ownerToken,
        topology: 'split',
      });
    });
    const bannerBaseline = bannerRenders.value;
    const portfolioBaseline = portfolioRenders.value;

    act(() => {
      probe.dispatch?.({
        type: 'sectionSourceChanged',
        ownerToken,
        sectionId: 'portfolio',
        result: {
          kind: 'ready',
          rowIds: ['asset-a'],
          data: { rows: ['asset-a'] },
          freshness: 'live',
          refresh: 'idle',
        },
      });
    });
    expect(portfolioRenders.value).toBe(portfolioBaseline + 1);
    expect(bannerRenders.value).toBe(bannerBaseline);

    const portfolioAfterLocalUpdate = portfolioRenders.value;
    const token = {
      protocolVersion: 1,
      clientInstanceId: 'client-local',
      producerInstanceId: 'producer-local',
      sessionId: ownerToken.sessionId,
      requestSeq: 1,
      sourceKey: {
        scopeKey: ownerToken.scopeKey,
        sourceId: 'banner' as const,
        paramsFingerprint: 'banner-local',
        dataSchemaVersion: 1,
      },
    } as const;
    act(() => {
      probe.dispatchBatch?.({
        events: [
          { type: 'sourceRequested', token },
          {
            type: 'sourceResponded',
            envelope: {
              token,
              result: {
                kind: 'success',
                coverageFingerprint: 'banner-a',
                data: {
                  banners: [],
                  referralEligibility: null,
                  tronResource: null,
                  isBotWalletReceiveBlocked: false,
                },
              },
            },
          },
        ],
      });
    });
    expect(bannerRenders.value).toBe(bannerBaseline + 1);
    expect(portfolioRenders.value).toBe(portfolioAfterLocalUpdate);

    const bannerAfterResourceUpdates = bannerRenders.value;
    const portfolioAfterResourceUpdates = portfolioRenders.value;
    act(() => {
      probe.dispatch?.({
        type: 'visibilityChanged',
        visibility: 'background',
      });
    });
    expect(bannerRenders.value).toBe(bannerAfterResourceUpdates);
    expect(portfolioRenders.value).toBe(portfolioAfterResourceUpdates);
  });

  it('reads only the affected resource and section for a local event', () => {
    const store = createStore();
    const ownerToken = {
      scopeKey: 'owner-read-set',
      sessionId: 'session-read-set',
    };
    dispatchHomeStoreEventsAtomically(store.get, store.set, {
      events: [
        {
          type: 'ownerChanged',
          owner: {
            walletId: 'wallet-read-set',
            accountId: 'account-read-set',
            network: { kind: 'allNetworks' },
          },
          ownerToken,
          topology: 'split',
        },
      ],
    });
    const getSpy = jest.spyOn(store, 'get');

    dispatchHomeStoreEventsAtomically(store.get, store.set, {
      events: [
        {
          type: 'sectionSourceChanged',
          ownerToken,
          sectionId: 'portfolio',
          result: {
            kind: 'ready',
            rowIds: ['asset-read-set'],
            data: { rows: ['asset-read-set'] },
            freshness: 'live',
            refresh: 'idle',
          },
        },
      ],
    });

    const readAtoms = new Set(getSpy.mock.calls.map(([target]) => target));
    expect(readAtoms).toContain(resourceStates.portfolio.atom());
    expect(readAtoms).toContain(sectionStates.portfolio.atom());
    expect(readAtoms).not.toContain(resourceStates.banner.atom());
    expect(readAtoms).not.toContain(resourceStates.nft.atom());
    expect(readAtoms).not.toContain(sectionStates.nft.atom());
    expect(readAtoms).not.toContain(homeShellState.atom());
  });
});
