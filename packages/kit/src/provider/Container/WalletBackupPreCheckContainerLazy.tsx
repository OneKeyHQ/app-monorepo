import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

type IWalletBackupPreCheckContainerComponent = ComponentType;

type IWalletBackupPreCheckPendingEvent =
  IAppEventBusPayload[EAppEventBusNames.CheckWalletBackupStatus];

function WalletBackupPreCheckContainerLazyCmp() {
  const [shouldMount, setShouldMount] = useState(false);
  const [loadRequestSeq, setLoadRequestSeq] = useState(0);
  const [ContainerImpl, setContainerImpl] =
    useState<IWalletBackupPreCheckContainerComponent | null>(null);
  const containerLoadedRef = useRef(false);
  const componentMountedRef = useRef(true);
  const pendingEventsRef = useRef<IWalletBackupPreCheckPendingEvent[]>([]);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settlePendingEventsAfterLoadFailure = useCallback(
    async (error: Error) => {
      const pendingEvents = pendingEventsRef.current;
      pendingEventsRef.current = [];
      await Promise.allSettled(
        pendingEvents.map((payload) => {
          if (
            payload.walletId &&
            accountUtils.isHdWallet({ walletId: payload.walletId })
          ) {
            // A missing backup check must block sensitive HD-wallet actions.
            return backgroundApiProxy.servicePromise.rejectCallback({
              id: payload.promiseId,
              error,
            });
          }
          return backgroundApiProxy.servicePromise.resolveCallback({
            id: payload.promiseId,
            data: true,
          });
        }),
      );
    },
    [],
  );

  useEffect(() => {
    containerLoadedRef.current = !!ContainerImpl;
  }, [ContainerImpl]);

  const requestMount = useCallback(() => {
    setShouldMount(true);
    setLoadRequestSeq((value) => value + 1);
  }, []);

  useEffect(() => {
    const handleCheckWalletBackupStatus = (
      payload: IWalletBackupPreCheckPendingEvent,
    ) => {
      if (containerLoadedRef.current) {
        return;
      }
      pendingEventsRef.current.push(payload);
      requestMount();
    };
    appEventBus.on(
      EAppEventBusNames.CheckWalletBackupStatus,
      handleCheckWalletBackupStatus,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.CheckWalletBackupStatus,
        handleCheckWalletBackupStatus,
      );
    };
  }, [requestMount]);

  useEffect(() => {
    if (!shouldMount || ContainerImpl) {
      return;
    }
    let isCurrentLoad = true;
    void import('../../components/WalletBackup/WalletBackupPreCheckContainer')
      .then((module) => {
        if (isCurrentLoad && componentMountedRef.current) {
          setContainerImpl(() => module.WalletBackupPreCheckContainer);
        }
      })
      .catch(async (error: Error) => {
        if (!isCurrentLoad || !componentMountedRef.current) {
          return;
        }
        defaultLogger.app.error.log(
          `[WalletBackupPreCheckContainerLazy] load failed: ${error.message}`,
        );
        // The callback expires only after a long bg sweep, so a failed main
        // runtime import must settle every queued request immediately.
        await settlePendingEventsAfterLoadFailure(error);
      });
    return () => {
      isCurrentLoad = false;
    };
  }, [
    ContainerImpl,
    loadRequestSeq,
    settlePendingEventsAfterLoadFailure,
    shouldMount,
  ]);

  useEffect(() => {
    if (!ContainerImpl || pendingEventsRef.current.length === 0) {
      return;
    }
    const pendingEvents = [...pendingEventsRef.current];
    pendingEventsRef.current = [];
    replayTimerRef.current = setTimeout(() => {
      for (const payload of pendingEvents) {
        appEventBus.emitToSelf({
          type: EAppEventBusNames.CheckWalletBackupStatus,
          payload,
        });
      }
    }, 0);
    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [ContainerImpl]);

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      void settlePendingEventsAfterLoadFailure(
        new OneKeyLocalError(
          'Wallet backup pre-check container unmounted before loading',
        ),
      );
    };
  }, [settlePendingEventsAfterLoadFailure]);

  if (!ContainerImpl) {
    return null;
  }
  return <ContainerImpl />;
}

export const WalletBackupPreCheckContainerLazy = memo(
  WalletBackupPreCheckContainerLazyCmp,
);
