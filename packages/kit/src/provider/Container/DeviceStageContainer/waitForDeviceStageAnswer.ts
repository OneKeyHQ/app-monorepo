import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';

export type IDeviceStageAnswer<T> =
  | { closed: true }
  | { closed: false; answer: T };

/**
 * Waits for an app-authored card on the DeviceStage to be answered — the
 * driver emits `name` with the answer — or for the stage to leave first:
 * the person closing it (the same announcement the legacy dialog's close
 * made), or any other exit (a call interrupted from outside, the firmware
 * page taking the screen). A card that is gone can never be answered, so
 * waiting on would hang the flow. Whichever comes first releases every
 * listener. `map` turns the payload into the answer; returning undefined
 * keeps waiting (an action handled without leaving the card).
 */
export function waitForDeviceStageAnswer<
  N extends keyof IAppEventBusPayload,
  T,
>(
  name: N,
  map: (payload: IAppEventBusPayload[N]) => T | undefined,
): Promise<IDeviceStageAnswer<T>> {
  return new Promise((resolve) => {
    // Reassigned once both listeners exist: each exit releases BOTH.
    let cleanup = () => {};
    const settle = (result: IDeviceStageAnswer<T>) => {
      cleanup();
      resolve(result);
    };
    const onAnswer = (payload: IAppEventBusPayload[N]) => {
      const answer = map(payload);
      if (answer !== undefined) {
        settle({ closed: false, answer });
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
  });
}
