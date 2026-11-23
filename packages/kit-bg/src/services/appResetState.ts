import { openDB } from 'idb';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const APP_RESET_CONTROL_NAME = 'onekey-app-reset-control';
const STORE = 'control';
const KEY = 'pending';

export type IAppResetMarker = {
  operationId: string;
  preserveBackupRecovery: boolean;
};

export type IAppRecoveryTestFault = 'hdWalletIdOccupied' | 'resetRemoteTimeout';

async function openResetControl() {
  return openDB(APP_RESET_CONTROL_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE);
    },
  });
}

export async function readAppResetMarker(): Promise<
  IAppResetMarker | undefined
> {
  if (!globalThis.indexedDB) return undefined;
  const db = await openResetControl();
  try {
    return (await db.get(STORE, KEY)) as IAppResetMarker | undefined;
  } finally {
    db.close();
  }
}

export async function writeAppResetMarker(
  marker?: IAppResetMarker,
): Promise<void> {
  if (!globalThis.indexedDB) return;
  const db = await openResetControl();
  try {
    if (marker) {
      await db.put(STORE, marker, KEY);
    } else {
      await db.delete(STORE, KEY);
    }
  } finally {
    db.close();
  }
}

export async function armAppRecoveryTestFaults(
  faults: IAppRecoveryTestFault[],
): Promise<void> {
  if (!globalThis.indexedDB) {
    throw new OneKeyLocalError('Fault simulation storage is unavailable');
  }
  const db = await openResetControl();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await Promise.all([
      ...faults.map((fault) => tx.store.put(true, fault)),
      tx.done,
    ]);
  } finally {
    db.close();
  }
}

export async function consumeAppRecoveryTestFault(
  fault: IAppRecoveryTestFault,
): Promise<boolean> {
  if (!globalThis.indexedDB) return false;
  const db = await openResetControl();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const armed = (await tx.store.get(fault)) === true;
    if (armed) await tx.store.delete(fault);
    await tx.done;
    return armed;
  } finally {
    db.close();
  }
}

let channel: BroadcastChannel | undefined;

export function listenForAppReset(onIsolate: () => void) {
  // Desktop sessions reset through the Electron restart path. Standalone web
  // tabs can otherwise keep operating from their independent in-memory state.
  if (
    !platformEnv.isWeb ||
    platformEnv.isJest ||
    typeof BroadcastChannel === 'undefined' ||
    channel
  )
    return;
  channel = new BroadcastChannel(APP_RESET_CONTROL_NAME);
  channel.onmessage = (event: MessageEvent<string>) => {
    if (event.data === 'isolating') onIsolate();
    if (event.data === 'completed') globalThis.location.reload();
  };
}

export function broadcastAppReset(stage: 'isolating' | 'completed') {
  channel?.postMessage(stage);
}

export async function runWithAppResetLock<T>(
  task: () => Promise<T>,
): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return task();
  return locks.request(
    APP_RESET_CONTROL_NAME,
    { ifAvailable: true },
    (lock) => {
      if (!lock) {
        throw new OneKeyLocalError('App reset is running in another window.');
      }
      return task();
    },
  );
}
