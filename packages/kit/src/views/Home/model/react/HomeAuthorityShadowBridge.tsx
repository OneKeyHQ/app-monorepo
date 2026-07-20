import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeActions,
  useHomeAuthoritativeNavigationAtom,
  useHomeAuthoritativeShellAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHomeRuntimeOwnerScope } from '@onekeyhq/shared/src/types/homeRuntime';

import { adaptCurrentHomeFacts } from '../facts/currentHomeFactsAdapter';
import { HomeSessionCoordinator } from '../lifecycle/homeSessionCoordinator';
import { SingleRuntimeHomeAdapter } from '../runtime/singleRuntimeHomeAdapter';
import { SplitRuntimeHomeAdapter } from '../runtime/splitRuntimeHomeAdapter';
import { projectHomeSemanticModel } from '../semantic/homeSemanticProjector';
import { HomeSemanticStore } from '../semantic/homeSemanticStore';
import {
  compareHomeSemanticShadow,
  createHomeShadowTrace,
} from '../semantic/homeShadowComparator';

export function HomeAuthorityShadowBridge() {
  const {
    activeAccount: { account, network, ready, wallet },
  } = useActiveAccount({ num: 0 });
  const actions = useHomeActions().current;
  const [authoritativeShell] = useHomeAuthoritativeShellAtom();
  const [authoritativeNavigation] = useHomeAuthoritativeNavigationAtom();
  const semanticStoreRef = useRef<HomeSemanticStore | undefined>(undefined);
  const publishRef = useRef<() => void>(() => undefined);
  const coordinator = useMemo(() => {
    if (platformEnv.isNative || platformEnv.isExtension) {
      return new HomeSessionCoordinator({
        adapter: new SplitRuntimeHomeAdapter({
          getHandshake: () =>
            backgroundApiProxy.serviceBootstrap.getHomeRuntimeHandshake(),
        }),
      });
    }
    return new HomeSessionCoordinator({
      adapter: new SingleRuntimeHomeAdapter(),
    });
  }, []);
  const owner = useMemo<IHomeRuntimeOwnerScope | undefined>(() => {
    if (!ready || !wallet?.id || !account?.id || !network?.id) {
      return undefined;
    }
    return {
      walletId: wallet.id,
      accountId: account.id,
      network: network.isAllNetworks
        ? { kind: 'allNetworks' }
        : { kind: 'singleNetwork', networkId: network.id },
    };
  }, [account?.id, network?.id, network?.isAllNetworks, ready, wallet?.id]);

  publishRef.current = () => {
    const startedAt = Date.now();
    const authority = coordinator.getSnapshot();
    actions.setAuthorityShadow(authority);
    if (!owner) {
      semanticStoreRef.current = undefined;
      actions.clearSemanticShadow();
      return;
    }
    const facts = adaptCurrentHomeFacts({
      owner,
      authority,
      wallet: {
        ready: true,
        backuped: wallet?.backuped,
        type: wallet?.type,
      },
      network: {
        hasAccount: Boolean(account),
        family: network?.impl,
      },
    });
    if (!facts) {
      semanticStoreRef.current = undefined;
      actions.clearSemanticShadow();
      return;
    }
    const semantic = projectHomeSemanticModel({
      authoritativeNavigation,
      authoritativeShell,
      facts,
    });
    if (!semanticStoreRef.current) {
      semanticStoreRef.current = new HomeSemanticStore(semantic);
    }
    const store = semanticStoreRef.current.publish(
      semantic,
      authoritativeShell,
      authoritativeNavigation,
    );
    const comparison = compareHomeSemanticShadow({
      shadow: semantic,
      notComparableReason:
        facts.runtime.connection === 'ready'
          ? 'currentObservationUnavailable'
          : 'runtimeNotReady',
    });
    actions.publishSemanticShadow({
      comparison,
      facts,
      store,
      trace: createHomeShadowTrace({
        comparison,
        durationMs: Date.now() - startedAt,
        ownerScopeKey: facts.ownerToken.scopeKey,
        sessionId: facts.ownerToken.sessionId,
      }),
    });
  };

  useEffect(() => {
    const publish = () => publishRef.current();
    const unsubscribe = coordinator.subscribe(publish);
    coordinator.setOwner(owner);
    publish();
    void coordinator.connectCurrent();
    return unsubscribe;
  }, [coordinator, owner]);

  useEffect(() => {
    publishRef.current();
  }, [
    authoritativeNavigation,
    authoritativeShell,
    network?.impl,
    wallet?.backuped,
    wallet?.type,
  ]);

  useEffect(
    () => () => {
      coordinator.stop();
      actions.resetAuthorityShadow();
    },
    [actions, coordinator],
  );

  return null;
}
