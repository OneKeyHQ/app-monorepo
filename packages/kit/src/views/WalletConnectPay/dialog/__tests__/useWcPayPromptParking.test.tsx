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
  isWcPayPromptParkingEnabled,
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

  it('reveals when the hardware state clears (the real teardown path)', () => {
    // How a hardware interaction actually ends: CLOSE_UI_WINDOW makes the
    // background set hardwareUiStateAtom to undefined.
    const { park, reveal, rerender } = setup();
    hardwareState = hardwareUiState(EHardwareUiStateAction.REQUEST_PIN);
    rerender({ enabled: true });

    hardwareState = undefined;
    rerender({ enabled: true });

    expect(park).toHaveBeenCalledTimes(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('does not re-park across an identity change between two prompts', () => {
    // The atom swaps one prompting action for another (confirm-on-device ->
    // the processing dialog the state machine emits after it). The sheet is
    // already parked, so nothing should move until the state clears.
    const { park, reveal, rerender } = setup();
    hardwareState = hardwareUiState(EHardwareUiStateAction.REQUEST_BUTTON);
    rerender({ enabled: true });
    expect(park).toHaveBeenCalledTimes(1);

    hardwareState = hardwareUiState(EHardwareUiStateAction.ProcessLoading);
    rerender({ enabled: true });
    expect(park).toHaveBeenCalledTimes(1);
    expect(reveal).not.toHaveBeenCalled();

    hardwareState = undefined;
    rerender({ enabled: true });

    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('classifier check: REQUEST_PIN then CLOSE_UI_PIN_WINDOW reveals', () => {
    // Classification only, NOT a runtime path: ServiceHardware never writes
    // CLOSE_UI_PIN_WINDOW to the atom (SKIPPED_EVENTS) and the state machine
    // rewrites that event to ProcessLoading, which parks. Kept so the
    // classifier's treatment of a close action stays pinned.
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

/**
 * Expected classification of EVERY hardware UI action, spelled out rather
 * than derived from the implementation's set — a derived table would agree
 * with any future change instead of catching it.
 *
 * `Record<EHardwareUiStateAction, boolean>` is the real guard: a member added
 * to the enum is a missing-property COMPILE error here (this file is inside
 * packages/kit's tsconfig), so it cannot ship unclassified. `true` = the
 * container puts a dialog or a toast on screen, which the system sheet would
 * cover, so the sheet must park.
 */
const EXPECTED_PROMPT_ACTIVE: Record<EHardwareUiStateAction, boolean> = {
  [EHardwareUiStateAction.DeviceChecking]: true,
  [EHardwareUiStateAction.EnterPinOnDevice]: true,
  [EHardwareUiStateAction.ProcessLoading]: true,
  [EHardwareUiStateAction.REQUEST_PIN]: true,
  [EHardwareUiStateAction.REQUEST_PIN_TYPE_PIN_ENTRY]: true,
  [EHardwareUiStateAction.REQUEST_PIN_TYPE_ATTACH_PIN]: true,
  [EHardwareUiStateAction.INVALID_PIN]: true,
  // the "confirm on device" toast
  [EHardwareUiStateAction.REQUEST_BUTTON]: true,
  [EHardwareUiStateAction.REQUEST_PASSPHRASE]: true,
  [EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE]: true,
  // routed to the app event bus, never written to the atom
  [EHardwareUiStateAction.REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE]: false,
  [EHardwareUiStateAction.REQUEST_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE]: false,
  [EHardwareUiStateAction.CLOSE_UI_WINDOW]: false,
  [EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW]: false,
  // dialog unless globalShowDeviceProgressDialogEnabled is false, which only
  // the batch-create-account dialog does — never during a payment
  [EHardwareUiStateAction.DEVICE_PROGRESS]: true,
  [EHardwareUiStateAction.BLUETOOTH_PERMISSION]: true,
  [EHardwareUiStateAction.BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE]: true,
  [EHardwareUiStateAction.LOCATION_PERMISSION]: true,
  [EHardwareUiStateAction.LOCATION_SERVICE_PERMISSION]: true,
  [EHardwareUiStateAction.FIRMWARE_PROCESSING]: true,
  [EHardwareUiStateAction.FIRMWARE_PROGRESS]: false,
  [EHardwareUiStateAction.FIRMWARE_TIP]: false,
  [EHardwareUiStateAction.PREVIOUS_ADDRESS]: false,
  [EHardwareUiStateAction.WEB_DEVICE_PROMPT_ACCESS_PERMISSION]: true,
  [EHardwareUiStateAction.DESKTOP_REQUEST_BLUETOOTH_PERMISSION]: true,
  [EHardwareUiStateAction.BLUETOOTH_PERMISSION_UNAUTHORIZED]: true,
  [EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING]: true,
  // never reach the atom (SKIPPED_EVENTS) but classify as parking: for a
  // surface that does render, parking is the fail-safe direction
  [EHardwareUiStateAction.BLUETOOTH_UNSUPPORTED]: true,
  [EHardwareUiStateAction.BLUETOOTH_POWERED_OFF]: true,
};

describe('isWcPayHardwarePromptActive', () => {
  it('is false without a state or an action', () => {
    expect(isWcPayHardwarePromptActive(undefined)).toBe(false);
    expect(isWcPayHardwarePromptActive({} as IHardwareUiState)).toBe(false);
  });

  it.each(Object.values(EHardwareUiStateAction))(
    'classifies %s',
    (action: EHardwareUiStateAction) => {
      expect(isWcPayHardwarePromptActive(hardwareUiState(action))).toBe(
        EXPECTED_PROMPT_ACTIVE[action],
      );
    },
  );

  // The Record catches an ADDED member at compile time; this catches the
  // runtime shape the sweep above depends on — a table key that no longer
  // corresponds to an enum value, and a table that has collapsed to one class.
  it('the table covers exactly the enum, in both classes', () => {
    const allActions = Object.values(EHardwareUiStateAction);
    const tableKeys = new Set(Object.keys(EXPECTED_PROMPT_ACTIVE));
    expect(tableKeys.size).toBe(allActions.length);
    for (const action of allActions) {
      expect(tableKeys.has(action)).toBe(true);
    }
    const values = Object.values(EXPECTED_PROMPT_ACTIVE);
    expect(values).toContain(true);
    expect(values).toContain(false);
  });
});

describe('isWcPayPromptParkingEnabled', () => {
  // All 8 combinations: only the native + paying + no-sub-flow row enables.
  it.each([
    {
      isNative: true,
      pagePhaseName: 'paying',
      isSubFlowOwningScreen: false,
      expected: true,
    },
    {
      isNative: true,
      pagePhaseName: 'paying',
      isSubFlowOwningScreen: true,
      expected: false,
    },
    {
      isNative: true,
      pagePhaseName: 'idle',
      isSubFlowOwningScreen: false,
      expected: false,
    },
    {
      isNative: true,
      pagePhaseName: 'idle',
      isSubFlowOwningScreen: true,
      expected: false,
    },
    {
      isNative: false,
      pagePhaseName: 'paying',
      isSubFlowOwningScreen: false,
      expected: false,
    },
    {
      isNative: false,
      pagePhaseName: 'paying',
      isSubFlowOwningScreen: true,
      expected: false,
    },
    {
      isNative: false,
      pagePhaseName: 'idle',
      isSubFlowOwningScreen: false,
      expected: false,
    },
    {
      isNative: false,
      pagePhaseName: 'idle',
      isSubFlowOwningScreen: true,
      expected: false,
    },
  ] as const)(
    'isNative=$isNative phase=$pagePhaseName subFlow=$isSubFlowOwningScreen -> $expected',
    ({ expected, ...params }) => {
      expect(isWcPayPromptParkingEnabled(params)).toBe(expected);
    },
  );

  it('the terminal result phase never parks, on either platform', () => {
    // Guarded separately from the table: `result` is terminal and its polling
    // must own the screen, so it must not be lumped in with `paying`.
    expect(
      isWcPayPromptParkingEnabled({
        isNative: true,
        pagePhaseName: 'result',
        isSubFlowOwningScreen: false,
      }),
    ).toBe(false);
    expect(
      isWcPayPromptParkingEnabled({
        isNative: false,
        pagePhaseName: 'result',
        isSubFlowOwningScreen: false,
      }),
    ).toBe(false);
  });
});
