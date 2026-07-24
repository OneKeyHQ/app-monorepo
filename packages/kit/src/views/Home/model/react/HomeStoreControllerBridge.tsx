import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { onNativeBackgroundThreadReady } from '@onekeyhq/shared/src/background/nativeBackgroundThreadReady';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
} from '@onekeyhq/shared/src/types/homeRuntime';

import {
  type IPreparedHomeDisplaySnapshot,
  loadPreparedHomeDisplaySnapshot,
} from '../cacheV2/loadPreparedHomeDisplaySnapshot';
import { buildHomeOwnerScopeKey } from '../core/homeIdentity';
import { adaptCurrentHomeFacts } from '../facts/currentHomeFactsAdapter';
import { HomeSessionCoordinator } from '../lifecycle/homeSessionCoordinator';
import { SingleRuntimeHomeAdapter } from '../runtime/singleRuntimeHomeAdapter';
import { SplitRuntimeHomeAdapter } from '../runtime/splitRuntimeHomeAdapter';

import { acquireHomeStoreControllerLease } from './homeStoreControllerLease';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

const HOME_OWNER_REPLACEMENT_CACHE_BUDGET_MS = 100;

async function loadPreparedOwnerWithinBudget(
  ownerScopeKey: string,
): Promise<IPreparedHomeDisplaySnapshot | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    let preparedOwner:
      | IPreparedHomeDisplaySnapshot
      | Promise<IPreparedHomeDisplaySnapshot | undefined>
      | undefined;
    try {
      preparedOwner = loadPreparedHomeDisplaySnapshot({ ownerScopeKey });
    } catch {
      return undefined;
    }
    return await Promise.race([
      Promise.resolve(preparedOwner).catch(() => undefined),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(
          () => resolve(undefined),
          HOME_OWNER_REPLACEMENT_CACHE_BUDGET_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function HomeStoreControllerBridge() {
  const {
    activeAccount: { account, network, ready, wallet },
  } = useActiveAccount({ num: 0 });
  const {
    controllerLeaseKey,
    publishHomeFactsChanged,
    publishHomeOwnerChanged,
    publishHomeRuntimeChanged,
    publishPreparedHomeOwner,
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

  useLayoutEffect(() => {
    const releaseControllerLease = acquireHomeStoreControllerLease({
      leaseId: controllerLeaseIdRef.current,
      storeKey: controllerLeaseKey,
    });
    let disposed = false;
    let ownerTransitionPending = false;
    let settingOwner = true;
    const getCurrentPayloads = () => {
      const inputs = inputsRef.current;
      const session = coordinator.getSnapshot();
      let connection: 'degraded' | 'ready' | 'stopped' | 'waiting' = 'waiting';
      if (session.status === 'active') {
        connection = 'ready';
      } else if (session.status === 'degraded') {
        connection = 'degraded';
      } else if (session.status === 'stopped') {
        connection = 'stopped';
      }
      const runtime = {
        runtime: {
          topology: session.topology,
          connection,
          producerInstanceId: session.producerInstanceId,
          protocolVersion: session.status === 'active' ? 1 : 0,
        },
      } as const;
      const facts =
        inputs.owner && session.ownerToken
          ? adaptCurrentHomeFacts({
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
            })
          : undefined;
      return { facts: facts ? { facts } : undefined, inputs, runtime, session };
    };
    const publish = () => {
      if (disposed || settingOwner || ownerTransitionPending) {
        return;
      }
      const { facts, inputs, runtime, session } = getCurrentPayloads();
      const ownerToken = session.ownerToken;
      if (
        Boolean(inputs.owner) !== Boolean(ownerToken) ||
        (inputs.owner &&
          ownerToken &&
          buildHomeOwnerScopeKey(inputs.owner) !== ownerToken.scopeKey)
      ) {
        return;
      }
      if (
        lastOwnerTokenRef.current?.scopeKey !== ownerToken?.scopeKey ||
        lastOwnerTokenRef.current?.sessionId !== ownerToken?.sessionId
      ) {
        if (lastOwnerTokenRef.current && inputs.owner && ownerToken) {
          ownerTransitionPending = true;
          void loadPreparedOwnerWithinBudget(ownerToken.scopeKey).then(
            (displaySnapshot) => {
              if (disposed) {
                return;
              }
              const currentSession = coordinator.getSnapshot();
              if (
                currentSession.ownerToken?.scopeKey !== ownerToken.scopeKey ||
                currentSession.ownerToken.sessionId !== ownerToken.sessionId
              ) {
                ownerTransitionPending = false;
                publish();
                return;
              }
              const currentPayloads = getCurrentPayloads();
              if (
                !currentPayloads.inputs.owner ||
                buildHomeOwnerScopeKey(currentPayloads.inputs.owner) !==
                  ownerToken.scopeKey
              ) {
                ownerTransitionPending = false;
                publish();
                return;
              }
              publishPreparedHomeOwner({
                displaySnapshot,
                facts: currentPayloads.facts,
                owner: {
                  owner: currentPayloads.inputs.owner,
                  ownerToken,
                  topology: currentPayloads.session.topology,
                },
                runtime: currentPayloads.runtime,
              });
              lastOwnerTokenRef.current = ownerToken;
              ownerTransitionPending = false;
            },
          );
          return;
        }
        lastOwnerTokenRef.current = ownerToken;
        publishHomeOwnerChanged({
          owner: inputs.owner,
          ownerToken,
          topology: session.topology,
        });
      }
      publishHomeRuntimeChanged(runtime);
      if (facts) {
        publishHomeFactsChanged(facts);
      }
    };
    publishRef.current = publish;

    const unsubscribe = coordinator.subscribe(publish);
    coordinator.setOwner(owner);
    settingOwner = false;
    publish();
    return () => {
      disposed = true;
      publishRef.current = () => undefined;
      unsubscribe();
      coordinator.stop();
      releaseControllerLease();
    };
  }, [
    controllerLeaseKey,
    coordinator,
    owner,
    publishHomeFactsChanged,
    publishHomeOwnerChanged,
    publishHomeRuntimeChanged,
    publishPreparedHomeOwner,
  ]);

  useEffect(() => {
    void coordinator.connectCurrent();
  }, [coordinator, owner]);

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
      { replayLatest: true },
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
