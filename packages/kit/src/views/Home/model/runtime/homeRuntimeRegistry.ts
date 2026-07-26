import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IHomeCommandExecution,
  IHomeDispatchReceipt,
  IHomeStoreEvent,
  IHomeStoreIntent,
} from '../store/homeStoreTypes';

export interface IHomeRuntimeDispatcher {
  dispatch: (event: IHomeStoreEvent) => IHomeDispatchReceipt;
  dispatchAtomically: (
    events: readonly IHomeStoreEvent[],
  ) => IHomeDispatchReceipt;
  executeIntent: <TResult>(
    intent: IHomeStoreIntent,
  ) => IHomeCommandExecution<TResult>;
}

const dispatcherByStore = new WeakMap<
  IJotaiContextStore,
  IHomeRuntimeDispatcher
>();

export function registerHomeRuntimeDispatcher(
  store: IJotaiContextStore,
  dispatcher: IHomeRuntimeDispatcher,
): () => void {
  const existing = dispatcherByStore.get(store);
  if (existing && existing !== dispatcher) {
    throw new OneKeyLocalError(
      'A Home Store cannot register two runtime dispatchers',
    );
  }
  dispatcherByStore.set(store, dispatcher);
  return () => {
    if (dispatcherByStore.get(store) === dispatcher) {
      dispatcherByStore.delete(store);
    }
  };
}

export function getHomeRuntimeDispatcher(
  store: IJotaiContextStore,
): IHomeRuntimeDispatcher | undefined {
  return dispatcherByStore.get(store);
}
