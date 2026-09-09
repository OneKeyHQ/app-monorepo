import { createElement, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { IWalletBackupPreCheckPendingEvent } from './WalletBackupPreCheckContainerLazy.utils';

type IWalletBackupPreCheckContainerComponent = ComponentType;
const bus = appEventBus;
const eventName = EAppEventBusNames.CheckWalletBackupStatus;

function settleEvents(
  pending: IWalletBackupPreCheckPendingEvent[],
  error: Error,
  logFailure = false,
  settler = import('./WalletBackupPreCheckContainerLazy.utils'),
) {
  const events = pending.splice(0);
  return settler
    .then((module) => module.settle(events, error, logFailure))
    .catch(() =>
      Promise.allSettled(
        events.map((event) =>
          backgroundApiProxy.servicePromise.rejectCallback({
            id: event.promiseId,
            error,
          }),
        ),
      ),
    );
}

export function WalletBackupPreCheckContainerLazy() {
  const [Impl, setImpl] =
    useState<IWalletBackupPreCheckContainerComponent | null>(null);
  const queueRef = useRef<IWalletBackupPreCheckPendingEvent[]>([]);

  useEffect(() => {
    if (Impl) {
      const timer = setTimeout(() => {
        queueRef.current.splice(0).forEach((payload) =>
          bus.emitToSelf({
            type: eventName,
            payload,
          }),
        );
      }, 0);
      return () => clearTimeout(timer);
    }
    let mounted = true;
    const handle = (payload: IWalletBackupPreCheckPendingEvent) => {
      queueRef.current.push(payload);
      const settler = import('./WalletBackupPreCheckContainerLazy.utils');
      void settler.catch(() => null);
      void import('../../components/WalletBackup/WalletBackupPreCheckContainer')
        .then((module) => {
          if (mounted) {
            setImpl(() => module.WalletBackupPreCheckContainer);
          }
        })
        .catch((error: Error) => {
          if (mounted) {
            void settleEvents(queueRef.current, error, true, settler);
          }
        });
    };
    bus.on(eventName, handle);
    return () => {
      mounted = false;
      bus.off(eventName, handle);
    };
  }, [Impl]);

  useEffect(
    () => () => {
      void settleEvents(queueRef.current, new Error('unmounted'));
    },
    [],
  );

  return Impl ? createElement(Impl) : null;
}
