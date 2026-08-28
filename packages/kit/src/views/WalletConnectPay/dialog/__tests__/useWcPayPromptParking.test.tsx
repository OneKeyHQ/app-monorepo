/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

// The two prompt atoms are the only inputs; they are mocked as plain module
// state so a rerender can move them without a jotai provider.
let passwordPrompt: unknown;
let hardwareState: unknown;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  __esModule: true,
  usePasswordPromptPromiseTriggerAtom: () => [
    { passwordPromptPromiseTriggerData: passwordPrompt },
  ],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/hardware', () => ({
  __esModule: true,
  useHardwareUiStateAtom: () => [hardwareState],
}));

import {
  isWcPayHardwarePromptActive,
  useWcPayPromptParking,
} from '../useWcPayPromptParking';

function hardwareUiState(action: EHardwareUiStateAction): IHardwareUiState {
  return { action, connectId: 'connect-1' } as IHardwareUiState;
}

function setup({ enabled = true }: { enabled?: boolean } = {}) {
  const park = jest.fn();
  const reveal = jest.fn();
  const utils = renderHook(
    (props: { enabled: boolean }) =>
      useWcPayPromptParking({ enabled: props.enabled, park, reveal }),
    { initialProps: { enabled } },
  );
  return { park, reveal, ...utils };
}

describe('useWcPayPromptParking', () => {
  beforeEach(() => {
    passwordPrompt = undefined;
    hardwareState = undefined;
  });

  it('parks once when the password prompt appears', () => {
    const { park, reveal, rerender } = setup();
    expect(park).not.toHaveBeenCalled();

    passwordPrompt = { idNumber: 1 };
    rerender({ enabled: true });
    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(1);
    expect(reveal).not.toHaveBeenCalled();
  });

  it('reveals once when the password prompt clears', () => {
    const { park, reveal, rerender } = setup();
    passwordPrompt = { idNumber: 1 };
    rerender({ enabled: true });

    passwordPrompt = undefined;
    rerender({ enabled: true });
    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled, even with a prompt up', () => {
    passwordPrompt = { idNumber: 1 };
    const { park, reveal, rerender } = setup({ enabled: false });
    rerender({ enabled: false });

    expect(park).not.toHaveBeenCalled();
    expect(reveal).not.toHaveBeenCalled();
  });

  it('parks when it is enabled while a prompt is already up', () => {
    passwordPrompt = { idNumber: 1 };
    const { park, rerender } = setup({ enabled: false });
    expect(park).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(1);
  });

  it('does not reveal when it is disabled while still parked', () => {
    // The terminal reveal belongs to the flow (handlePay's finally /
    // onAfterConfirmModalSettled), never to this hook.
    const { park, reveal, rerender } = setup();
    passwordPrompt = { idNumber: 1 };
    rerender({ enabled: true });
    expect(park).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });

    expect(reveal).not.toHaveBeenCalled();
  });

  it('never reveals over a pushed confirm page', () => {
    // The confirm page disables the hook (the flow parks for it and owns the
    // reveal). A prompt raised BY that page must not bring the sheet back on
    // top of it when it clears.
    const { reveal, rerender } = setup();
    passwordPrompt = { idNumber: 1 };
    rerender({ enabled: true });

    rerender({ enabled: false });
    passwordPrompt = undefined;
    rerender({ enabled: false });

    expect(reveal).not.toHaveBeenCalled();
  });

  it('re-parks after a disable/enable cycle with the prompt still up', () => {
    const { park, rerender } = setup();
    passwordPrompt = { idNumber: 1 };
    rerender({ enabled: true });
    rerender({ enabled: false });

    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(2);
  });

  it('parks for a hardware PIN request', () => {
    const { park, rerender } = setup();
    hardwareState = hardwareUiState(EHardwareUiStateAction.REQUEST_PIN);
    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(1);
  });

  it('parks for the confirm-on-device button request (a toast)', () => {
    const { park, rerender } = setup();
    hardwareState = hardwareUiState(EHardwareUiStateAction.REQUEST_BUTTON);
    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(1);
  });

  it.each([
    EHardwareUiStateAction.CLOSE_UI_WINDOW,
    EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
    EHardwareUiStateAction.PREVIOUS_ADDRESS,
    EHardwareUiStateAction.FIRMWARE_TIP,
    EHardwareUiStateAction.FIRMWARE_PROGRESS,
  ])('does not park for %s', (action) => {
    const { park, rerender } = setup();
    hardwareState = hardwareUiState(action);
    rerender({ enabled: true });

    expect(park).not.toHaveBeenCalled();
  });

  it('reveals on the transition from REQUEST_PIN to CLOSE_UI_PIN_WINDOW', () => {
    const { park, reveal, rerender } = setup();
    hardwareState = hardwareUiState(EHardwareUiStateAction.REQUEST_PIN);
    rerender({ enabled: true });

    hardwareState = hardwareUiState(EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW);
    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('parks once and reveals only after both overlapping prompts clear', () => {
    const { park, reveal, rerender } = setup();
    passwordPrompt = { idNumber: 1 };
    rerender({ enabled: true });

    hardwareState = hardwareUiState(EHardwareUiStateAction.REQUEST_BUTTON);
    rerender({ enabled: true });
    passwordPrompt = undefined;
    rerender({ enabled: true });
    expect(park).toHaveBeenCalledTimes(1);
    expect(reveal).not.toHaveBeenCalled();

    hardwareState = undefined;
    rerender({ enabled: true });

    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('does not reveal when unmounted while parked', () => {
    const { park, reveal, rerender, unmount } = setup();
    passwordPrompt = { idNumber: 1 };
    rerender({ enabled: true });
    expect(park).toHaveBeenCalledTimes(1);

    unmount();

    expect(reveal).not.toHaveBeenCalled();
  });
});

// Hardware actions that render nothing the user has to see or answer, so the
// sheet may stay up. Everything else opens the hardware dialog or the
// confirm-on-device toast.
const NO_UI_ACTIONS: EHardwareUiStateAction[] = [
  EHardwareUiStateAction.CLOSE_UI_WINDOW,
  EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
  EHardwareUiStateAction.FIRMWARE_TIP,
  EHardwareUiStateAction.FIRMWARE_PROGRESS,
  EHardwareUiStateAction.PREVIOUS_ADDRESS,
  EHardwareUiStateAction.REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE,
  EHardwareUiStateAction.REQUEST_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE,
];

describe('isWcPayHardwarePromptActive', () => {
  it('is false without a state or an action', () => {
    expect(isWcPayHardwarePromptActive(undefined)).toBe(false);
    expect(isWcPayHardwarePromptActive({} as IHardwareUiState)).toBe(false);
  });

  // Exhaustive by construction: a member added to the enum later is in
  // neither list and fails here until it is deliberately classified.
  it.each(Object.values(EHardwareUiStateAction))(
    'classifies %s',
    (action: EHardwareUiStateAction) => {
      expect(isWcPayHardwarePromptActive(hardwareUiState(action))).toBe(
        !NO_UI_ACTIONS.includes(action),
      );
    },
  );

  it('the no-UI list is a subset of the enum and does not cover it', () => {
    const allActions = new Set<string>(Object.values(EHardwareUiStateAction));
    for (const action of NO_UI_ACTIONS) {
      expect(allActions.has(action)).toBe(true);
    }
    expect(NO_UI_ACTIONS.length).toBeLessThan(allActions.size);
  });
});
