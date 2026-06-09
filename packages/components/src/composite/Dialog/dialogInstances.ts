import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { IDialogInstance } from './type';

const dialogInstances: IDialogInstance[] = [];

export function getDialogInstances(): IDialogInstance[] {
  return dialogInstances;
}

export function addDialogInstance(instance: IDialogInstance): void {
  if (!dialogInstances.includes(instance)) {
    dialogInstances.push(instance);
  }
}

export function removeDialogInstance(instance: IDialogInstance): void {
  const idx = dialogInstances.indexOf(instance);
  if (idx !== -1) {
    dialogInstances.splice(idx, 1);
    // Notify consumers waiting for a blocking dialog to close (e.g. the KYT
    // intro auto-pop) so they can re-evaluate immediately instead of polling.
    // Emitted after the splice so getDialogInstances() already excludes it.
    appEventBus.emit(EAppEventBusNames.DialogClosed, undefined);
  }
}

export async function closeAllDialogInstances(): Promise<void> {
  const instances = [...dialogInstances];
  if (instances.length === 0) {
    return;
  }
  await Promise.allSettled(
    instances
      .filter((instance) => instance.isExist())
      .map((instance) => Promise.resolve(instance.close())),
  );
}
