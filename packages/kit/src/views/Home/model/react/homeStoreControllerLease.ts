import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const controllerLeaseByStore = new WeakMap<object, symbol>();

export function acquireHomeStoreControllerLease({
  leaseId,
  storeKey,
}: {
  leaseId: symbol;
  storeKey: object;
}) {
  const activeLease = controllerLeaseByStore.get(storeKey);
  if (activeLease && activeLease !== leaseId) {
    throw new OneKeyLocalError(
      'A Home Store scene cannot mount more than one controller authority.',
    );
  }
  controllerLeaseByStore.set(storeKey, leaseId);
  return () => {
    if (controllerLeaseByStore.get(storeKey) === leaseId) {
      controllerLeaseByStore.delete(storeKey);
    }
  };
}
