import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import {
  HardwareUiEventQueue,
  createHardwareUiEventState,
  reduceHardwareUiEventState,
} from './hardwareUiEventStateMachine';

const createInteraction = (overrides: Record<string, unknown> = {}) => ({
  interactionId: 'interaction-1',
  phaseId: 'pin-phase',
  sequence: 1,
  phase: 'pin',
  transition: 'start',
  protocol: 'V2',
  ...overrides,
});

describe('hardware UI event state machine', () => {
  it('keeps Passphrase visible when an old PIN completion arrives late', () => {
    let state = createHardwareUiEventState();

    let result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.REQUEST_PIN,
      renderAction: EHardwareUiStateAction.EnterPinOnDevice,
      connectId: 'PRO2_USB',
      payload: {
        interaction: createInteraction(),
      },
    });
    state = result.state;

    result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      payload: createInteraction({ sequence: 2, transition: 'complete' }),
    });
    expect(result.action).toBe(EHardwareUiStateAction.ProcessLoading);
    expect(result.state.phase).toBe('processing');
    state = result.state;

    result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.REQUEST_PASSPHRASE,
      renderAction: EHardwareUiStateAction.REQUEST_PASSPHRASE,
      connectId: 'PRO2_USB',
      payload: {
        interaction: createInteraction({
          phase: 'passphrase',
          phaseId: 'passphrase-phase',
          sequence: 3,
        }),
      },
    });
    state = result.state;

    result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      payload: createInteraction({ sequence: 4, transition: 'complete' }),
    });

    expect(result.applied).toBe(false);
    expect(result.action).toBeUndefined();
    expect(result.state.phase).toBe('passphrase');
  });

  it('serializes async handlers and continues after one handler fails', async () => {
    const queue = new HardwareUiEventQueue<string>();
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue('pin', async () => {
      order.push('pin:start');
      await firstFinished;
      order.push('pin:end');
      throw new OneKeyLocalError('expected failure');
    });
    const second = queue.enqueue('passphrase', async () => {
      order.push('passphrase');
    });

    await Promise.resolve();
    expect(order).toEqual(['pin:start']);

    releaseFirst?.();
    await expect(first).rejects.toThrow('expected failure');
    await expect(second).resolves.toBeUndefined();
    expect(order).toEqual(['pin:start', 'pin:end', 'passphrase']);
  });

  it('invalidates a running handler after reset', async () => {
    const queue = new HardwareUiEventQueue<string>();
    let releaseHandler: (() => void) | undefined;
    const handlerReleased = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    let isCurrentAfterReset = true;

    const task = queue.enqueue('pin', async (_event, { isCurrent }) => {
      await handlerReleased;
      isCurrentAfterReset = isCurrent();
    });

    await Promise.resolve();
    queue.reset();
    releaseHandler?.();
    await task;

    expect(isCurrentAfterReset).toBe(false);
  });

  it('supports Protocol V1 PIN completion without interaction metadata', () => {
    let state = createHardwareUiEventState();
    state = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.REQUEST_PIN,
      renderAction: EHardwareUiStateAction.REQUEST_PIN,
      connectId: 'CLASSIC_USB',
    }).state;

    const result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
    });

    expect(result.applied).toBe(true);
    expect(result.action).toBe(EHardwareUiStateAction.ProcessLoading);
    expect(result.connectId).toBe('CLASSIC_USB');
  });

  it('marks a PIN completion as such, since it renders as plain progress', () => {
    // The reduction is indistinguishable from a progress tick by action
    // alone, and a tick may not write over an ask — so a consumer with no
    // flag to read leaves the answered PIN card standing (OK-59934).
    let state = createHardwareUiEventState();
    state = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.REQUEST_PIN,
      renderAction: EHardwareUiStateAction.EnterPinOnDevice,
      connectId: 'PRO_BLE',
    }).state;

    const completion = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
    });
    expect(completion.askCompleted).toBe(true);

    const tick = reduceHardwareUiEventState(completion.state, {
      type: EHardwareUiStateAction.DEVICE_PROGRESS,
      renderAction: EHardwareUiStateAction.DEVICE_PROGRESS,
      connectId: 'PRO_BLE',
    });
    expect(tick.askCompleted).toBeFalsy();
  });

  test.each([
    [
      EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      EHardwareUiStateAction.REQUEST_PIN,
      'pin',
    ],
    [
      EHardwareUiStateAction.CLOSE_UI_WINDOW,
      EHardwareUiStateAction.REQUEST_PASSPHRASE,
      'passphrase',
    ],
  ] as const)(
    'ignores metadata-less %s from a previous V1 device',
    (closeType, requestType, phase) => {
      let state = reduceHardwareUiEventState(createHardwareUiEventState(), {
        type: EHardwareUiStateAction.REQUEST_PIN,
        renderAction: EHardwareUiStateAction.REQUEST_PIN,
        connectId: 'CLASSIC_USB',
      }).state;
      state = reduceHardwareUiEventState(state, {
        type: requestType,
        renderAction: requestType,
        connectId: 'PRO2_USB',
        payload: {
          interaction: createInteraction({
            interactionId: 'interaction-2',
            phase,
            phaseId: `${phase}-phase`,
          }),
        },
      }).state;

      const result = reduceHardwareUiEventState(state, {
        type: closeType,
        renderAction: closeType,
      });

      expect(result.applied).toBe(false);
      expect(result.state.connectId).toBe('PRO2_USB');
      expect(result.state.phase).toBe(phase);
    },
  );

  it('ignores a stale close event from an older interaction', () => {
    const state = reduceHardwareUiEventState(createHardwareUiEventState(), {
      type: EHardwareUiStateAction.REQUEST_PASSPHRASE,
      renderAction: EHardwareUiStateAction.REQUEST_PASSPHRASE,
      connectId: 'PRO2_USB',
      payload: {
        interaction: createInteraction({
          interactionId: 'interaction-2',
          phase: 'passphrase',
          phaseId: 'passphrase-phase',
        }),
      },
    }).state;

    const result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      payload: createInteraction({
        interactionId: 'interaction-1',
        sequence: 4,
        transition: 'finish',
      }),
    });

    expect(result.applied).toBe(false);
    expect(result.state.phase).toBe('passphrase');
  });

  it('accepts the final metadata-less close after V2 progress reopens a closed interaction', () => {
    let state = reduceHardwareUiEventState(createHardwareUiEventState(), {
      type: EHardwareUiStateAction.REQUEST_BUTTON,
      renderAction: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId: 'PRO2_USB',
      payload: {
        interaction: createInteraction({ phase: 'button' }),
      },
    }).state;
    state = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      payload: createInteraction({
        phase: 'button',
        sequence: 2,
        transition: 'finish',
      }),
    }).state;

    expect(state.phase).toBe('closed');

    state = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.DEVICE_PROGRESS,
      renderAction: EHardwareUiStateAction.DEVICE_PROGRESS,
      payload: { progress: 100 },
    }).state;

    const result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_WINDOW,
    });

    expect(result.applied).toBe(true);
    expect(result.action).toBe(EHardwareUiStateAction.CLOSE_UI_WINDOW);
    expect(result.state.phase).toBe('closed');
    expect(result.connectId).toBe('PRO2_USB');
  });

  it('accepts a new device after the previous interaction closes', () => {
    let state = reduceHardwareUiEventState(createHardwareUiEventState(), {
      type: EHardwareUiStateAction.REQUEST_BUTTON,
      renderAction: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId: 'PRO2_USB_A',
      payload: {
        interaction: createInteraction({ phase: 'button' }),
      },
    }).state;
    state = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      renderAction: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      payload: createInteraction({ sequence: 2, transition: 'finish' }),
    }).state;

    const result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.REQUEST_BUTTON,
      renderAction: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId: 'PRO2_USB_B',
      payload: {
        interaction: createInteraction({
          interactionId: 'interaction-2',
          phase: 'button',
        }),
      },
    });

    expect(result.applied).toBe(true);
    expect(result.state.connectId).toBe('PRO2_USB_B');
    expect(result.state.phase).toBe('button');
  });

  it('accepts firmware status from a reconnected device', () => {
    const state = reduceHardwareUiEventState(createHardwareUiEventState(), {
      type: EHardwareUiStateAction.REQUEST_BUTTON,
      renderAction: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId: 'PRO2_USB_BEFORE_REBOOT',
    }).state;

    const result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.FIRMWARE_PROGRESS,
      renderAction: EHardwareUiStateAction.FIRMWARE_PROGRESS,
      connectId: 'PRO2_USB_AFTER_REBOOT',
      payload: { progress: 25, progressType: 'installingFirmware' },
    });

    expect(result.applied).toBe(true);
    expect(result.connectId).toBe('PRO2_USB_AFTER_REBOOT');
    expect(result.state.connectId).toBe('PRO2_USB_AFTER_REBOOT');
  });

  it('lets a new device request replace a stale open interaction', () => {
    const state = reduceHardwareUiEventState(createHardwareUiEventState(), {
      type: EHardwareUiStateAction.REQUEST_BUTTON,
      renderAction: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId: 'PRO2_USB_A',
      payload: {
        interaction: createInteraction({ phase: 'button' }),
      },
    }).state;

    const result = reduceHardwareUiEventState(state, {
      type: EHardwareUiStateAction.REQUEST_BUTTON,
      renderAction: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId: 'PRO2_USB_B',
      payload: {
        interaction: createInteraction({
          interactionId: 'interaction-2',
          phase: 'button',
        }),
      },
    });

    expect(result.applied).toBe(true);
    expect(result.state.connectId).toBe('PRO2_USB_B');
  });
});
