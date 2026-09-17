import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

export type IDeviceStageAnswer<T> =
  | { closed: true }
  | { closed: false; answer: T };

export interface IDeviceStageAnswerWatch<T> {
  answer: Promise<IDeviceStageAnswer<T>>;
  /** Releases the listeners for a card that never landed. Answering or
   * an exit releases them on its own, and cancelling after that is a
   * no-op, so this is safe in a `finally`. */
  cancel: () => void;
}

/**
 * Starts listening for an app-authored card's answer BEFORE the card is
 * asked for, and hands back the promise plus a release.
 *
 * The order matters. Asking the background to paint the card is an RPC,
 * and on iOS, Android and the extension `main` and `bg` are separate JS
 * runtimes: the answer and the exit announcements cross that boundary as
 * events. A listener installed only after the RPC resolves misses
 * anything the background said while the call was in flight — the person
 * going back, the firmware workflow taking the stage — and the flow then
 * waits forever on a card that is already gone. Desktop and web share one
 * runtime but still yield at the `await`, so the window is real there
 * too. Listen first, ask second, and release when the card never landed.
 */
export function watchForDeviceStageAnswer<
  N extends keyof IAppEventBusPayload,
  T,
>(
  name: N,
  map: (payload: IAppEventBusPayload[N]) => T | undefined,
): IDeviceStageAnswerWatch<T> {
  let release = () => {};
  const answer = new Promise<IDeviceStageAnswer<T>>((resolve) => {
    // Reassigned once both listeners exist: each exit releases BOTH.
    let cleanup = () => {};
    const settle = (result: IDeviceStageAnswer<T>) => {
      cleanup();
      resolve(result);
    };
    const onAnswer = (payload: IAppEventBusPayload[N]) => {
      const mapped = map(payload);
      if (mapped !== undefined) {
        settle({ closed: false, answer: mapped });
      }
    };
    const onClosed = () => settle({ closed: true });
    cleanup = () => {
      appEventBus.off(name, onAnswer);
      appEventBus.off(
        EAppEventBusNames.CloseHardwareUiStateDialogManually,
        onClosed,
      );
      appEventBus.off(EAppEventBusNames.DeviceStageOff, onClosed);
    };
    appEventBus.on(name, onAnswer);
    appEventBus.on(
      EAppEventBusNames.CloseHardwareUiStateDialogManually,
      onClosed,
    );
    appEventBus.on(EAppEventBusNames.DeviceStageOff, onClosed);
    // The card never landed: the caller releases the listeners and reads
    // the wait as a close, so nothing is left holding the bus.
    release = () => settle({ closed: true });
  });
  return { answer, cancel: () => release() };
}
