import { useCallback, useEffect, useRef } from 'react';

import type { INativeBackgroundThreadReadySignal } from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxyBase';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountSelectorSceneInfo } from '../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';

import {
  isAccountSelectorBackgroundRecoveryRawReadySequenceCurrent,
  markAccountSelectorBackgroundRecoveryRawReady,
  publishAccountSelectorBackgroundRecoveryComplete,
} from './accountSelectorBackgroundRecovery';

export function AccountSelectorStorageInit() {
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const ownerKey = `${sceneName}:${sceneUrl ?? ''}`;
  const activeOwnerRef = useRef({ generation: 0, ownerKey });
  if (activeOwnerRef.current.ownerKey !== ownerKey) {
    activeOwnerRef.current = {
      generation: activeOwnerRef.current.generation + 1,
      ownerKey,
    };
  }
  const ownerGeneration = activeOwnerRef.current.generation;
  const initChainRef = useRef<Promise<void>>(Promise.resolve());
  const initTaskBySignalKeyRef = useRef(new Map<string, Promise<void>>());
  const publishedSignalKeysRef = useRef(new Set<string>());

  const initFromStorage = useCallback(
    () =>
      actions.current.initFromStorage({
        sceneName,
        sceneUrl,
      }),
    [actions, sceneName, sceneUrl],
  );

  useEffect(() => {
    let disposed = false;

    const queueInitFromStorage = (
      readySignal?: INativeBackgroundThreadReadySignal,
    ) => {
      const signalKey = `${ownerGeneration}:${ownerKey}:${
        readySignal?.sequence ?? 'standalone'
      }`;
      if (publishedSignalKeysRef.current.has(signalKey)) {
        return;
      }
      let initTask = initTaskBySignalKeyRef.current.get(signalKey);
      if (!initTask) {
        initTask = initChainRef.current
          .catch(() => undefined)
          .then(initFromStorage);
        initTaskBySignalKeyRef.current.set(signalKey, initTask);
        initChainRef.current = initTask.catch(() => undefined);
      }
      void initTask
        .then(() => {
          if (
            disposed ||
            !readySignal ||
            activeOwnerRef.current.ownerKey !== ownerKey ||
            activeOwnerRef.current.generation !== ownerGeneration ||
            publishedSignalKeysRef.current.has(signalKey) ||
            !isAccountSelectorBackgroundRecoveryRawReadySequenceCurrent({
              owner: { sceneName, sceneUrl },
              sequence: readySignal.sequence,
            })
          ) {
            return;
          }
          publishedSignalKeysRef.current.add(signalKey);
          publishAccountSelectorBackgroundRecoveryComplete({
            owner: { sceneName, sceneUrl },
            readySignal,
          });
        })
        .catch(() => undefined);
    };

    const unsubscribe = backgroundApiProxy.subscribeNativeBackgroundThreadReady(
      (signal) => {
        markAccountSelectorBackgroundRecoveryRawReady({
          owner: { sceneName, sceneUrl },
          readySignal: signal,
        });
        queueInitFromStorage(signal);
      },
    );

    // Standalone runtimes have no native ready signal. Keep their existing
    // mount-time initialization path unchanged.
    if (!unsubscribe) {
      queueInitFromStorage();
    }

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [initFromStorage, ownerGeneration, ownerKey, sceneName, sceneUrl]);

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.WalletClear, initFromStorage);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletClear, initFromStorage);
    };
  }, [initFromStorage]);

  return null;
}
