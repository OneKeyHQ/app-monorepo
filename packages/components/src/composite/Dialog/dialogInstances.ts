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
  }
}

export async function closeAllDialogInstances(): Promise<void> {
  const instances = [...dialogInstances];
  if (instances.length === 0) {
    return;
  }
  await Promise.allSettled(
    instances.map((instance) =>
      instance.isExist() ? instance.close() : undefined,
    ),
  );
}
