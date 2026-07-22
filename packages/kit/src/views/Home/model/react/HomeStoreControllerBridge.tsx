import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { onNativeBackgroundThreadReady } from '@onekeyhq/shared/src/background/nativeBackgroundThreadReady';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { adaptCurrentHomeFacts } from '../facts/currentHomeFactsAdapter';
import { HomeSessionCoordinator } from '../lifecycle/homeSessionCoordinator';
import { SingleRuntimeHomeAdapter } from '../runtime/singleRuntimeHomeAdapter';
import { SplitRuntimeHomeAdapter } from '../runtime/splitRuntimeHomeAdapter';

import { acquireHomeStoreControllerLease } from './homeStoreControllerLease';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

export function HomeStoreControllerBridge() {
  const {
    activeAccount: { account, network, ready, wallet },
  } = useActiveAccount({ num: 0 });
  const {
    controllerLeaseKey,
    publishHomeFactsChanged,
    publishHomeOwnerChanged,
    publishHomeRuntimeChanged,
    stopHomeStore,
  } = useHomeStoreControllerActions();
  const controllerLeaseIdRef = useRef(Symbol('home-store-controller'));
  const lastOwnerTokenRef = useRef<IHomeRuntimeOwnerToken | undefined>(
    undefined,
  );
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
  const inputsRef = useRef({ account, network, owner, wallet });
  inputsRef.current = { account, network, owner, wallet };

  useEffect(
    () =>
      acquireHomeStoreControllerLease({
        leaseId: controllerLeaseIdRef.current,
        storeKey: controllerLeaseKey,
      }),
    [controllerLeaseKey],
  );

  useEffect(() => {
    const publish = () => {
      const inputs = inputsRef.current;
      const session = coordinator.getSnapshot();
      const ownerToken = session.ownerToken;
      if (
        lastOwnerTokenRef.current?.scopeKey !== ownerToken?.scopeKey ||
        lastOwnerTokenRef.current?.sessionId !== ownerToken?.sessionId
      ) {
        lastOwnerTokenRef.current = ownerToken;
        publishHomeOwnerChanged({
          owner: inputs.owner,
          ownerToken,
          topology: session.topology,
        });
      }
      let connection: 'degraded' | 'ready' | 'stopped' | 'waiting' = 'waiting';
      if (session.status === 'active') {
        connection = 'ready';
      } else if (session.status === 'degraded') {
        connection = 'degraded';
      } else if (session.status === 'stopped') {
        connection = 'stopped';
      }
      publishHomeRuntimeChanged({
        runtime: {
          topology: session.topology,
          connection,
          producerInstanceId: session.producerInstanceId,
          protocolVersion: session.status === 'active' ? 1 : 0,
        },
      });
      if (!inputs.owner || !ownerToken) {
        return;
      }
      const facts = adaptCurrentHomeFacts({
        owner: inputs.owner,
        authority: session,
        wallet: {
          ready: true,
          backuped: inputs.wallet?.backuped,
          type: inputs.wallet?.type,
        },
        network: {
          hasAccount: Boolean(inputs.account),
          family: inputs.network?.impl,
        },
      });
      if (!facts) {
        return;
      }
      publishHomeFactsChanged({
        facts,
      });
    };
    publishRef.current = publish;

    const unsubscribe = coordinator.subscribe(publish);
    coordinator.setOwner(owner);
    publish();
    void coordinator.connectCurrent();
    return () => {
      publishRef.current = () => undefined;
      unsubscribe();
      coordinator.stop();
    };
  }, [
    coordinator,
    owner,
    publishHomeFactsChanged,
    publishHomeOwnerChanged,
    publishHomeRuntimeChanged,
  ]);

  useEffect(() => {
    publishRef.current();
  }, [account, network?.impl, owner, wallet?.backuped, wallet?.type]);

  useEffect(() => {
    if (!(platformEnv.isNative || platformEnv.isExtension)) {
      return;
    }
    let lastReadySequence = 0;
    return onNativeBackgroundThreadReady(
      (signal) => {
        if (signal.sequence <= lastReadySequence) {
          return;
        }
        lastReadySequence = signal.sequence;
        if (signal.reason === 'restarted') {
          coordinator.restartCurrent();
          publishRef.current();
        }
        void coordinator.refreshHandshake();
      },
      { replayLatest: false },
    );
  }, [coordinator]);

  useEffect(
    () => () => {
      stopHomeStore();
    },
    [stopHomeStore],
  );

  return null;
}
