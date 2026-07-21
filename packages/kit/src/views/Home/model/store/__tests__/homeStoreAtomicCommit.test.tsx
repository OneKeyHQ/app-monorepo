/** @jest-environment jsdom */

import { type ReactNode, useLayoutEffect, useMemo } from 'react';

import { act, render } from '@testing-library/react';

import {
  ProviderJotaiContextHome,
  useHomeCommitIdentity,
  useHomeSessionState,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { useHomeStoreInternalActions } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';

import type { IHomeStoreState } from '../homeStoreTypes';

type IProbe = {
  dispatch?: ReturnType<
    typeof useHomeStoreInternalActions
  >['current']['dispatchHomeEvent'];
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
    probe.read = actions.readHomeStoreSnapshot;
    probe.snapshots.push(actions.readHomeStoreSnapshot());
  }, [actions, commit, probe, session]);
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
});
