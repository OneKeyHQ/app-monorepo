import { createElement, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { IWalletBackupPreCheckPendingEvent } from './WalletBackupPreCheckContainerLazy.utils';

type IWalletBackupPreCheckContainerComponent = ComponentType;
const eventName = EAppEventBusNames.CheckWalletBackupStatus;

function settlePendingEvents(
  pendingEvents: IWalletBackupPreCheckPendingEvent[],
  error: Error,
  logLoadFailure = false,
) {
  return import('./WalletBackupPreCheckContainerLazy.utils').then((module) =>
    module.settleWalletBackupPreCheckPendingEvents({
      error,
      pendingEvents: pendingEvents.splice(0),
      logLoadFailure,
    }),
  );
}

export function WalletBackupPreCheckContainerLazy() {
  const [Container, setContainer] =
    useState<IWalletBackupPreCheckContainerComponent | null>(null);
  const pendingRef = useRef<IWalletBackupPreCheckPendingEvent[]>([]);

  useEffect(() => {
    if (Container) {
      const pendingEvents = pendingRef.current.splice(0);
      const timer = setTimeout(() => {
        pendingEvents.forEach((payload) =>
          appEventBus.emitToSelf({
            type: eventName,
            payload,
          }),
        );
      }, 0);
      return () => clearTimeout(timer);
    }
    let mounted = true;
    const handleEvent = (payload: IWalletBackupPreCheckPendingEvent) => {
      pendingRef.current.push(payload);
      void import('../../components/WalletBackup/WalletBackupPreCheckContainer')
        .then((module) => {
          if (mounted) {
            setContainer(() => module.WalletBackupPreCheckContainer);
          }
        })
        .catch((error: Error) => {
          if (mounted) {
            void settlePendingEvents(pendingRef.current, error, true);
          }
        });
    };
    appEventBus.on(eventName, handleEvent);
    return () => {
      mounted = false;
      appEventBus.off(eventName, handleEvent);
    };
  }, [Container]);

  useEffect(
    () => () => {
      void settlePendingEvents(
        pendingRef.current,
        new Error('Wallet backup pre-check unmounted'),
      );
    },
    [],
  );

  return Container ? createElement(Container) : null;
}
