import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { watchForDeviceStageAnswer } from './waitForDeviceStageAnswer';

/**
 * The ordering contract the app-authored cards depend on: the listeners
 * exist before the background is asked to paint, so nothing the
 * background announces in that window is missed. On iOS, Android and the
 * extension `main` and `bg` are separate runtimes and these arrive as
 * bridged events; the flows hang forever on anything they do not hear.
 */
describe('watchForDeviceStageAnswer', () => {
  const answerEvent = EAppEventBusNames.DeviceStageWalletTypeSelected;

  const listenerCount = () =>
    appEventBus.listenerCount(answerEvent) +
    appEventBus.listenerCount(
      EAppEventBusNames.CloseHardwareUiStateDialogManually,
    ) +
    appEventBus.listenerCount(EAppEventBusNames.DeviceStageOff);

  it('hears an exit announced before the caller awaits the answer', async () => {
    const watch = watchForDeviceStageAnswer(answerEvent, ({ walletType }) =>
      walletType === 'hidden' ? 'Hidden' : 'Standard',
    );

    // The window the paint RPC occupies: the stage leaves before anyone
    // awaits. Registering the listener after the RPC would drop this.
    appEventBus.emit(EAppEventBusNames.DeviceStageOff, undefined);

    await expect(watch.answer).resolves.toEqual({ closed: true });
    expect(listenerCount()).toBe(0);
  });

  it('resolves with the answer the driver sends', async () => {
    const watch = watchForDeviceStageAnswer(answerEvent, ({ walletType }) =>
      walletType === 'hidden' ? 'Hidden' : 'Standard',
    );

    appEventBus.emit(answerEvent, { walletType: 'hidden' });

    await expect(watch.answer).resolves.toEqual({
      closed: false,
      answer: 'Hidden',
    });
    expect(listenerCount()).toBe(0);
  });

  it('releases the listeners when the paint call itself fails', async () => {
    // The callers release in a `finally`, so a bridge call that threw
    // leaves nothing on the bus: repeated failures would otherwise pile
    // up abandoned runs, each waking on the next stage event.
    const watch = watchForDeviceStageAnswer(answerEvent, ({ walletType }) =>
      walletType === 'hidden' ? 'Hidden' : 'Standard',
    );
    let painted = false;
    await expect(
      (async () => {
        try {
          painted = await Promise.reject(new Error('bridge down'));
        } finally {
          if (!painted) {
            watch.cancel();
          }
        }
      })(),
    ).rejects.toThrow('bridge down');

    await expect(watch.answer).resolves.toEqual({ closed: true });
    expect(listenerCount()).toBe(0);
  });

  it('releases the listeners when the card never landed', async () => {
    const watch = watchForDeviceStageAnswer(answerEvent, ({ walletType }) =>
      walletType === 'hidden' ? 'Hidden' : 'Standard',
    );
    expect(listenerCount()).toBeGreaterThan(0);

    // A silenced stage painted nothing: the caller releases and reads the
    // wait as a close, and a second release is a no-op.
    watch.cancel();
    watch.cancel();

    await expect(watch.answer).resolves.toEqual({ closed: true });
    expect(listenerCount()).toBe(0);
  });
});
