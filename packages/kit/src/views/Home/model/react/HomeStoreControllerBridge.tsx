import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { onNativeBackgroundThreadReady } from '@onekeyhq/shared/src/background/nativeBackgroundThreadReady';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
} from '@onekeyhq/shared/src/types/homeRuntime';

import {
  loadHomeStartupPreparedDisplaySnapshot,
  prepareHomeDisplaySnapshot,
} from '../cache/homeStartupPreparedDisplaySnapshot';
import { buildHomeOwnerScopeKey } from '../core/homeIdentity';
import { adaptCurrentHomeFacts } from '../facts/currentHomeFactsAdapter';
import { HomeSessionCoordinator } from '../lifecycle/homeSessionCoordinator';
import { SingleRuntimeHomeAdapter } from '../runtime/singleRuntimeHomeAdapter';
import { SplitRuntimeHomeAdapter } from '../runtime/splitRuntimeHomeAdapter';

import { acquireHomeStoreControllerLease } from './homeStoreControllerLease';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

import type { IPreparedHomeDisplaySnapshot } from '../cache/loadPreparedHomeDisplaySnapshot.types';

const HOME_OWNER_REPLACEMENT_CACHE_BUDGET_MS = 100;

type IPreparedOwnerProbe =
  | {
      displaySnapshot: IPreparedHomeDisplaySnapshot | undefined;
      kind: 'ready';
    }
  | {
      kind: 'pending';
      task: Promise<IPreparedHomeDisplaySnapshot | undefined>;
    };

function waitForPreparedOwnerWithinBudget(
  task: Promise<IPreparedHomeDisplaySnapshot | undefined>,
): Promise<IPreparedHomeDisplaySnapshot | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(undefined);
    }, HOME_OWNER_REPLACEMENT_CACHE_BUDGET_MS);
    const finish = (
      displaySnapshot: IPreparedHomeDisplaySnapshot | undefined,
    ) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(displaySnapshot);
    };
    void task.then(finish, () => finish(undefined));
  });
}

function probePreparedOwnerWithinBudget(
  ownerScopeKey: string,
): IPreparedOwnerProbe {
  try {
    const startupHandle = loadHomeStartupPreparedDisplaySnapshot();
    const startupOwnerScopeKey =
      startupHandle?.kind === 'ready'
        ? startupHandle.result.ownerScopeKey
        : startupHandle?.ownerScopeKey;
    const handle =
      startupHandle && startupOwnerScopeKey === ownerScopeKey
        ? startupHandle
        : prepareHomeDisplaySnapshot({ ownerScopeKey });
    if (handle.kind === 'ready') {
      return {
        displaySnapshot: handle.result.displaySnapshot,
        kind: 'ready',
      };
    }
    return {
      kind: 'pending',
      task: waitForPreparedOwnerWithinBudget(
        handle.task.then((result) => result.displaySnapshot),
      ),
    };
  } catch {
    return { displaySnapshot: undefined, kind: 'ready' };
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

  useEffect(() => {
    const releaseControllerLease = acquireHomeStoreControllerLease({
      leaseId: controllerLeaseIdRef.current,
      storeKey: controllerLeaseKey,
    });
    let disposed = false;
    let ownerTransitionPending = false;
    let settingOwner = true;
    let publish: () => void = () => undefined;
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
    const finishPreparedOwner = ({
      displaySnapshot,
      ownerToken,
    }: {
      displaySnapshot: IPreparedHomeDisplaySnapshot | undefined;
      ownerToken: IHomeRuntimeOwnerToken;
    }) => {
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
    };
    publish = () => {
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
        if (inputs.owner && ownerToken) {
          ownerTransitionPending = true;
          const probe = probePreparedOwnerWithinBudget(ownerToken.scopeKey);
          if (probe.kind === 'ready') {
            finishPreparedOwner({
              displaySnapshot: probe.displaySnapshot,
              ownerToken,
            });
          } else {
            void probe.task.then((displaySnapshot) => {
              finishPreparedOwner({ displaySnapshot, ownerToken });
            });
          }
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
