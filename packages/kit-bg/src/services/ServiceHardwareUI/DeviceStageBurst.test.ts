import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ECustomOneKeyHardwareError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { setDeviceStageBurstActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import {
  EFirmwareUpdateTipMessages,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';

import {
  EHardwareUiStateAction,
  EThirdPartyHardwareUiAction,
  deviceStageAtom,
  firmwareUpdateWorkflowRunningAtom,
} from '../../states/jotai/atoms';

import {
  DeviceStageBurstScope,
  createLatestStateFeed,
  pickDeviceType,
  pickErrorMessage,
  pickIdentityText,
  pickQrScoped,
  resolveDeviceNotFoundLanding,
} from './DeviceStageBurst';

import type {
  IDeviceStageState,
  IHardwareUiPayload,
} from '../../states/jotai/atoms';

jest.mock('../../states/jotai/atoms', () => {
  // Real enum objects: the burst scope builds its action-to-step maps at
  // module scope, so stubbed members would collapse every key into a
  // single "undefined".
  const {
    EHardwareUiStateAction: HardwareUiStateAction,
    EThirdPartyHardwareUiAction: ThirdPartyHardwareUiAction,
  } = jest.requireActual('../../states/jotai/atoms');
  return {
    EHardwareUiStateAction: HardwareUiStateAction,
    EThirdPartyHardwareUiAction: ThirdPartyHardwareUiAction,
    deviceStageAtom: {
      get: jest.fn(),
      set: jest.fn(),
    },
    firmwareUpdateWorkflowRunningAtom: {
      get: jest.fn(),
    },
  };
});

jest.mock('@onekeyhq/shared/src/hardware/deviceStageOwnership', () => {
  const actual: typeof import('@onekeyhq/shared/src/hardware/deviceStageOwnership') =
    jest.requireActual('@onekeyhq/shared/src/hardware/deviceStageOwnership');

  return {
    ...actual,
    setDeviceStageBurstActive: jest.fn(),
  };
});

describe('pickDeviceType', () => {
  it('keeps the device it already identified when an event does not know', () => {
    // SDK progress ticks carry no device and arrive stamped `unknown`;
    // taking that at face value dropped the replica mid-flow.
    expect(pickDeviceType(EDeviceType.Unknown, EDeviceType.Pro)).toBe(
      EDeviceType.Pro,
    );
  });

  it('learns the device the first time anything names it', () => {
    expect(pickDeviceType(EDeviceType.Pro, undefined)).toBe(EDeviceType.Pro);
  });

  it('lets a real model replace another', () => {
    expect(pickDeviceType(EDeviceType.Pro2, EDeviceType.Pro)).toBe(
      EDeviceType.Pro2,
    );
  });

  it('stays unknown while nothing has ever named the device', () => {
    expect(pickDeviceType(EDeviceType.Unknown, undefined)).toBe(
      EDeviceType.Unknown,
    );
  });
});

describe('pickIdentityText', () => {
  // The repro this rule exists for: the SDK's call-end close arrives with
  // connectId '', which won a `??` and erased the device the stage had
  // named — so the burst reached its end with nothing to probe, and an
  // unplugged device landed as a generic failure, not a disconnect.
  it('keeps the named device when a close event carries no name', () => {
    expect(pickIdentityText('', 'PRB09B0058A')).toBe('PRB09B0058A');
  });

  it('keeps what it knows when an event says nothing at all', () => {
    expect(pickIdentityText(undefined, 'PRB09B0058A')).toBe('PRB09B0058A');
  });

  it('learns the device the first time anything names it', () => {
    expect(pickIdentityText('PRB09B0058A', undefined)).toBe('PRB09B0058A');
  });

  it('lets one real name replace another', () => {
    expect(pickIdentityText('NEO-035F', 'PRB09B0058A')).toBe('NEO-035F');
  });

  it('stays unknown while nothing has ever named it', () => {
    expect(pickIdentityText('', undefined)).toBeUndefined();
    expect(pickIdentityText(undefined, undefined)).toBeUndefined();
  });
});

describe('pickQrScoped', () => {
  const ur = { type: 'onekey-app-call-device' } as NonNullable<
    IDeviceStageState['qrValueUr']
  >;
  const newerUr = { type: 'eth-sign-request' } as NonNullable<
    IDeviceStageState['qrValueUr']
  >;

  it('carries the code across the crossing to the camera and back', () => {
    // The way back from scanQr re-presents the same code — dropping it at
    // the crossing would land the person on an empty white card.
    expect(pickQrScoped('scanQr', undefined, ur)).toBe(ur);
    expect(pickQrScoped('showQr', undefined, ur)).toBe(ur);
  });

  it('lets an explicit hand-over replace what the step showed', () => {
    expect(pickQrScoped('showQr', newerUr, ur)).toBe(newerUr);
  });

  it('drops the code the moment the stage leaves the pair', () => {
    // No other step may re-present a stale request code — and no stale
    // session tag may authorize a submit (the same rule carries both).
    expect(pickQrScoped('processing', undefined, ur)).toBeUndefined();
    expect(pickQrScoped('error', undefined, ur)).toBeUndefined();
    expect(pickQrScoped('off', undefined, ur)).toBeUndefined();
    expect(pickQrScoped('processing', undefined, 7)).toBeUndefined();
  });

  it('carries the session tag by the same rule', () => {
    expect(pickQrScoped('scanQr', undefined, 7)).toBe(7);
    expect(pickQrScoped('showQr', 8, 7)).toBe(8);
  });

  it('never invents one outside the pair, explicit or not', () => {
    expect(pickQrScoped('connecting', ur, undefined)).toBeUndefined();
  });
});

describe('resolveDeviceNotFoundLanding', () => {
  it('lands the Device-not-connected card when the burst never heard from the device', () => {
    // A call initiated with no device present fails the SDK's initial
    // search — nothing has spoken, so this is mapping-A's deviceNotFound.
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: false,
        sawDeviceEventThisBurst: false,
      }),
    ).toBe('deviceNotFound');
  });

  it('keeps the disconnect notice for a device the burst has heard from', () => {
    // A later call in the same burst re-searches an unplugged device and
    // throws the very same 105 — that is a mid-burst unplug, and the
    // agreed split keeps it on the disconnect notice.
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: false,
        sawDeviceEventThisBurst: true,
      }),
    ).toBe('disconnected');
  });

  it('never lands the outcome card on a vendor burst', () => {
    // The vendor track's deviceNotFound is the adapter's live retry ask,
    // not an ending — a 105 there keeps today's error path either way.
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: true,
        sawDeviceEventThisBurst: false,
      }),
    ).toBe('disconnected');
    expect(
      resolveDeviceNotFoundLanding({
        wasVendorBurst: true,
        sawDeviceEventThisBurst: true,
      }),
    ).toBe('disconnected');
  });
});

describe('pickErrorMessage', () => {
  it('carries the words the error already localized', () => {
    // OK-59934: the hardware error layer resolves a class's translation
    // key into `.message`, and the stage suppresses the toast that used
    // to speak it — so the card has to.
    expect(
      pickErrorMessage({
        message:
          'Passphrase does not match the current wallet, please try again',
      }),
    ).toBe('Passphrase does not match the current wallet, please try again');
  });

  it('carries a raw SDK line too, rather than saying nothing', () => {
    expect(
      pickErrorMessage({ message: 'Protocol V2 USB read failed: transferIn' }),
    ).toBe('Protocol V2 USB read failed: transferIn');
  });

  it('declines what it cannot speak', () => {
    expect(pickErrorMessage(undefined)).toBeUndefined();
    expect(pickErrorMessage({})).toBeUndefined();
    expect(pickErrorMessage({ message: '   ' })).toBeUndefined();
    expect(pickErrorMessage({ message: 500 })).toBeUndefined();
    expect(pickErrorMessage('a bare string, not an error')).toBeUndefined();
  });
});

/** The scope's own beats, mirrored here: the deferred opening `connecting`
 * and the grace window a follow-up burst may cancel. */
const OPENING_BEAT_DEFER_MS = 120;
const OFF_GRACE_MS = 600;

const CONNECT_ID = 'PRB09B0058A';

type IStageWrite =
  | IDeviceStageState
  | ((prev: IDeviceStageState | undefined) => IDeviceStageState);

const stageAtom = deviceStageAtom as unknown as {
  get: jest.Mock<Promise<IDeviceStageState | undefined>, []>;
  set: jest.Mock<Promise<void>, [IStageWrite]>;
};
const firmwareWorkflowAtom = firmwareUpdateWorkflowRunningAtom as unknown as {
  get: jest.Mock<Promise<boolean>, []>;
};
const burstActiveFlag = jest.mocked(setDeviceStageBurstActive);

describe('DeviceStageBurstScope', () => {
  // The atom stands in for the real cross-runtime one: a single value the
  // scope reads back between beats, updater form included.
  let stage: IDeviceStageState | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(errorToastUtils, 'showToastOfError')
      .mockImplementation(() => undefined);
    jest.useFakeTimers();
    stage = undefined;
    stageAtom.get.mockImplementation(async () => stage);
    stageAtom.set.mockImplementation(async (next) => {
      stage = typeof next === 'function' ? next(stage) : next;
    });
    firmwareWorkflowAtom.get.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** Lets the deferred opening beat paint, so the stage is visibly on. */
  const paintOpeningBeat = () =>
    jest.advanceTimersByTimeAsync(OPENING_BEAT_DEFER_MS);

  /** Lets the scheduled exit run out. */
  const letTheExitRun = () => jest.advanceTimersByTimeAsync(OFF_GRACE_MS);

  it('rolls back a failed join so the explicit holder can close its stage', async () => {
    const scope = new DeviceStageBurstScope();
    const token = await scope.beginExplicit({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    const error = new OneKeyLocalError('Stage broadcast failed');
    stageAtom.set.mockRejectedValueOnce(error);

    await expect(scope.begin({ connectId: CONNECT_ID })).rejects.toBe(error);
    expect(burstActiveFlag).toHaveBeenLastCalledWith(true);
    await scope.endExplicit({ token });
    await letTheExitRun();
    expect(stage?.step).toBe('off');
    expect(burstActiveFlag).toHaveBeenLastCalledWith(false);
  });

  it('releases a failed initial open and allows the next operation to close', async () => {
    const scope = new DeviceStageBurstScope();
    const error = new OneKeyLocalError('Stage read failed');
    stageAtom.get.mockRejectedValueOnce(error);

    await expect(scope.begin({ connectId: CONNECT_ID })).rejects.toBe(error);
    expect(burstActiveFlag).toHaveBeenLastCalledWith(false);
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');
    await scope.end();
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('does not release a new burst when a dismissed join later fails', async () => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    let rejectWrite: ((error: Error) => void) | undefined;
    stageAtom.set.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectWrite = reject;
        }),
    );
    const error = new OneKeyLocalError('Late stage broadcast failed');
    const joining = scope
      .begin({ connectId: CONNECT_ID })
      .catch((caught: unknown) => caught);
    await jest.advanceTimersByTimeAsync(0);
    expect(rejectWrite).toBeDefined();
    await scope.userClose();
    await scope.begin({ connectId: 'NEW_DEVICE' });
    await paintOpeningBeat();
    rejectWrite?.(error);
    await expect(joining).resolves.toBe(error);

    expect(burstActiveFlag).toHaveBeenLastCalledWith(true);
    await scope.end();
    await letTheExitRun();
    expect(stage?.step).toBe('off');
    expect(burstActiveFlag).toHaveBeenLastCalledWith(false);
  });

  it.each([false, true])(
    'closes skipped verification immediately without ending an outer flow (%s)',
    async (hasOuterFlow) => {
      const scope = new DeviceStageBurstScope();
      const token = hasOuterFlow
        ? await scope.beginExplicit({ connectId: CONNECT_ID })
        : undefined;
      await scope.begin({ connectId: CONNECT_ID });
      await scope.noteStep('authFailure', {
        authFailureReason: 'unknown',
      });

      await scope.noteAuthNarrativeResolved();
      expect(stage?.step).toBe('off');
      expect(stage?.authFailureReason).toBeUndefined();
      expect(burstActiveFlag).toHaveBeenLastCalledWith(true);
      await scope.end();

      if (token !== undefined) {
        expect(burstActiveFlag).toHaveBeenLastCalledWith(true);
        await scope.noteStep('confirm', { connectId: CONNECT_ID });
        expect(stage?.step).toBe('confirm');
        await scope.endExplicit({ token });
      }
      expect(burstActiveFlag).toHaveBeenLastCalledWith(false);
      await letTheExitRun();
      expect(stage?.step).toBe('off');
    },
  );

  it('does not close a newer ask when resolving an old verification failure', async () => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await scope.noteStep('authFailure', { authFailureReason: 'unknown' });
    await scope.noteStep('pinOnApp', { connectId: CONNECT_ID });

    await scope.noteAuthNarrativeResolved();
    expect(stage?.step).toBe('pinOnApp');
  });

  it('does not dismiss a newer failure while an earlier resolution is reading', async () => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await scope.noteStep('authFailure', { authFailureReason: 'unknown' });
    let releaseRead: (() => void) | undefined;
    stageAtom.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseRead = () => resolve(stage);
        }),
    );
    const resolving = scope.noteAuthNarrativeResolved();
    await jest.advanceTimersByTimeAsync(0);
    expect(releaseRead).toBeDefined();
    await scope.noteStep('authFailure', {
      authFailureReason: 'unofficialDevice',
    });
    releaseRead?.();
    await resolving;
    expect(stage?.step).toBe('authFailure');
    expect(stage?.authFailureReason).toBe('unofficialDevice');
  });

  it('releases the burst even when the firmware workflow silences the stage mid-flight', async () => {
    // startUpdateWorkflow raises the flag and only THEN waits for the
    // hardware work in flight to drain, so this wrapper's end() runs
    // silenced. Its bookkeeping still has to happen: a gated end that
    // kept the layer left every later burst unable to reach its own exit.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');

    firmwareWorkflowAtom.get.mockResolvedValue(true);
    await scope.end();
    expect(burstActiveFlag).toHaveBeenLastCalledWith(false);
    // Silenced, the exit still lands: the update page owns the screen and
    // the capsule must not stand over it behind its touch wall.
    expect(stage?.step).toBe('off');

    // The update page cleared the flag in its own finally; the next burst
    // must behave like any other.
    firmwareWorkflowAtom.get.mockResolvedValue(false);
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.end();
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('opens the burst when a hold minted while silenced is presented again', async () => {
    // Onboarding holds across the firmware page: the token minted while
    // the workflow silenced the stage held nothing, and presenting it
    // again after the update used to only merge identity — the resumed
    // flow ran without its stage.
    firmwareWorkflowAtom.get.mockResolvedValue(true);
    const scope = new DeviceStageBurstScope();
    const token = await scope.beginExplicit({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(stage).toBeUndefined();

    firmwareWorkflowAtom.get.mockResolvedValue(false);
    await expect(
      scope.beginExplicit({ connectId: CONNECT_ID, reuseToken: token }),
    ).resolves.toBe(token);
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');

    // Presented once more, the open hold only refreshes identity.
    await scope.beginExplicit({ connectId: CONNECT_ID, reuseToken: token });
    await scope.endExplicit({ token });
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('takes down a checking beat no burst ever claimed, and nothing else', async () => {
    // A connect painted its checking beat, then handed off to the
    // bootloader dialog: no burst began, so no end() would ever land the
    // exit and the stage stood over the dialog until its close grant armed.
    const scope = new DeviceStageBurstScope();
    await scope.noteStep('connecting', { connectId: CONNECT_ID });
    expect(stage?.step).toBe('connecting');
    await scope.dismissUnowned();
    expect(stage?.step).toBe('off');

    // A stage a burst owns is left to that burst's own end.
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.dismissUnowned();
    expect(stage?.step).toBe('connecting');
    await scope.end();
    await letTheExitRun();

    // An outcome owns its own exit, burst or not.
    await scope.noteStep('error', { connectId: CONNECT_ID });
    await scope.dismissUnowned();
    expect(stage?.step).toBe('error');
  });

  it('does not open when the firmware workflow takes the stage while begin is reading', async () => {
    // begin() passed the gate, then parked on its atom read; the workflow
    // raised the guard and silenced the stage meanwhile. The silence found
    // no pendingOpen yet, so the opening timer used to paint connecting
    // over the update page — and the caller was told the burst opened.
    const scope = new DeviceStageBurstScope();
    let releaseRead: (() => void) | undefined;
    stageAtom.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseRead = () => resolve(stage);
        }),
    );
    const opening = scope.begin({ connectId: CONNECT_ID });
    await jest.advanceTimersByTimeAsync(0);
    expect(releaseRead).toBeDefined();

    firmwareWorkflowAtom.get.mockResolvedValue(true);
    await scope.silence();

    releaseRead?.();
    await expect(opening).resolves.toBe(false);
    await paintOpeningBeat();
    expect(stage).toBeUndefined();
    expect(burstActiveFlag).toHaveBeenLastCalledWith(false);

    // The rolled-back claim leaves nothing behind: the next burst after
    // the update page behaves like any other.
    firmwareWorkflowAtom.get.mockResolvedValue(false);
    await expect(scope.begin({ connectId: CONNECT_ID })).resolves.toBe(true);
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');
    await scope.end();
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('answers whether the stage is behind the caller', async () => {
    // The air-gap flow paints its beats past the gate and must decide on this
    // answer, not on a gate read taken before begin(): the flag can flip in
    // between, and a QR card with no burst behind it has no exit.
    const scope = new DeviceStageBurstScope();
    await expect(scope.begin({ connectId: CONNECT_ID })).resolves.toBe(true);
    // A nested join answers the same way.
    await expect(scope.begin({ connectId: CONNECT_ID })).resolves.toBe(true);

    firmwareWorkflowAtom.get.mockResolvedValue(true);
    await expect(scope.begin({ connectId: CONNECT_ID })).resolves.toBe(false);
  });

  it('writes nothing to the stage while the firmware workflow owns the screen', async () => {
    firmwareWorkflowAtom.get.mockResolvedValue(true);
    const scope = new DeviceStageBurstScope();

    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.end();
    await letTheExitRun();

    expect(stageAtom.set).not.toHaveBeenCalled();
    expect(stage).toBeUndefined();
  });

  it('plays the device’s own asks during the firmware workflow and leaves on their close (OK-62087)', async () => {
    firmwareWorkflowAtom.get.mockResolvedValue(true);
    const scope = new DeviceStageBurstScope();
    // Nothing holds a burst: the workflow's wrapper is refused, yet the
    // device's PIN ask lands, the answer holds as processing, and the
    // call's close takes the stage down again.
    await expect(scope.begin({ connectId: CONNECT_ID })).resolves.toBe(false);
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_PIN,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('pinOnApp');
    await scope.noteInputSubmitted();
    expect(stage?.step).toBe('processing');
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  const passphraseAsk = (deviceType: EDeviceType) =>
    ({ deviceType, connectId: CONNECT_ID }) as IHardwareUiPayload;

  it.each([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo])(
    'lands a %s on its on-screen confirm once an app-typed passphrase is handed over',
    async (deviceType) => {
      // The firmware confirms a host passphrase with no ButtonRequest, so no
      // ui-button follows the submit — the stage used to sit on processing
      // while the device waited on the person.
      const scope = new DeviceStageBurstScope();
      await scope.begin({ connectId: CONNECT_ID });
      await scope.onHardwareUiEvent({
        action: EHardwareUiStateAction.REQUEST_PASSPHRASE,
        connectId: CONNECT_ID,
        payload: passphraseAsk(deviceType),
      });
      expect(stage?.step).toBe('passphraseOnApp');

      await scope.noteInputSubmitted({ hostPassphraseEntered: true });
      expect(stage?.step).toBe('confirm');
      expect(stage?.connectId).toBe(CONNECT_ID);

      // The person confirms on the device and the call ends: back to the
      // wait while the flow's next call runs.
      await scope.onHardwareUiEvent({
        action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
        connectId: CONNECT_ID,
      });
      expect(stage?.step).toBe('processing');
      await scope.end();
      await letTheExitRun();
      expect(stage?.step).toBe('off');
    },
  );

  it.each([
    [
      'a Touch, whose own ButtonRequest paints the confirm',
      EDeviceType.Touch,
      true,
    ],
    ['a Classic 1S, which shows no confirm', EDeviceType.Classic1s, true],
    ['a Pro given an empty passphrase', EDeviceType.Pro, false],
  ])(
    'holds %s on processing after the passphrase submit',
    async (_label, deviceType, hostPassphraseEntered) => {
      const scope = new DeviceStageBurstScope();
      await scope.begin({ connectId: CONNECT_ID });
      await scope.onHardwareUiEvent({
        action: EHardwareUiStateAction.REQUEST_PASSPHRASE,
        connectId: CONNECT_ID,
        payload: passphraseAsk(deviceType),
      });
      await scope.noteInputSubmitted({ hostPassphraseEntered });
      expect(stage?.step).toBe('processing');
    },
  );

  it('keeps the plain wait for input that did not answer a passphrase ask', async () => {
    // A PIN typed on the app is followed by whatever the device asks next;
    // the confirm is the passphrase screen's alone.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_PIN,
      connectId: CONNECT_ID,
      payload: passphraseAsk(EDeviceType.Pro),
    });
    await scope.noteInputSubmitted({ hostPassphraseEntered: true });
    expect(stage?.step).toBe('processing');
  });

  it('plays the install confirm tip as the confirm ask and steps aside for the transfer', async () => {
    firmwareWorkflowAtom.get.mockResolvedValue(true);
    const scope = new DeviceStageBurstScope();
    const tip = (message: EFirmwareUpdateTipMessages) =>
      ({ firmwareTipData: { message } }) as IHardwareUiPayload;
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.FIRMWARE_TIP,
      connectId: CONNECT_ID,
      payload: tip(EFirmwareUpdateTipMessages.ConfirmOnDevice),
    });
    expect(stage?.step).toBe('confirm');
    // Pro 2 / Touch post InstallingFirmware and the install's 0% tick
    // right behind the confirm tip, before the person has pressed
    // anything: the card stands through both.
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.FIRMWARE_TIP,
      connectId: CONNECT_ID,
      payload: tip(EFirmwareUpdateTipMessages.InstallingFirmware),
    });
    expect(stage?.step).toBe('confirm');
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
      connectId: CONNECT_ID,
      payload: {
        firmwareProgress: 0,
        firmwareProgressType: 'installingFirmware',
        firmwareTipData: {
          message: EFirmwareUpdateTipMessages.ConfirmOnDevice,
        },
      } as IHardwareUiPayload,
    });
    expect(stage?.step).toBe('confirm');
    // The transfer moving is the person's approval: the screen goes to
    // the page's progress bar.
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
      connectId: CONNECT_ID,
      payload: { firmwareProgress: 3 } as IHardwareUiPayload,
    });
    expect(stage?.step).toBe('off');
    // A late InstallingFirmware tip raises nothing by itself.
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.FIRMWARE_TIP,
      connectId: CONNECT_ID,
      payload: tip(EFirmwareUpdateTipMessages.InstallingFirmware),
    });
    expect(stage?.step).toBe('off');
    // A PIN the device still wants is not narration: it stands through
    // a tip that is not the confirm.
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_PIN,
      connectId: CONNECT_ID,
    });
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.FIRMWARE_TIP,
      connectId: CONNECT_ID,
      payload: tip(EFirmwareUpdateTipMessages.DownloadFirmware),
    });
    expect(stage?.step).toBe('pinOnApp');
  });

  it('keeps a yielded stage off the dialog through the interrupted call’s stragglers', async () => {
    // The bootloader hand-off: the connect flow holds a burst, the stage
    // yields to the dialog, and the features call it interrupted still
    // drains its close and a trailing tick through the event queue.
    // Neither may put a wait back over the dialog; the device asking
    // again is news and lifts the yield.
    const scope = new DeviceStageBurstScope();
    const token = await scope.beginExplicit({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');
    await scope.silence();
    expect(stage?.step).toBe('off');
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('off');
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.ProcessLoading,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('off');
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_PIN,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('pinOnApp');
    // Lifted: the hold's own beats play again.
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('processing');
    await scope.endExplicit({ token });
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('takes down a wait a straggler paints while the yield reads the stage', async () => {
    // The Ledger install sheet (OK-62656): the probe's last beat on the
    // third-party rail is still crossing the event queue when the dialog
    // asks the stage to yield. Landing between the yield's read and its
    // write, a `ui` action claims the stage (clearOffTimer bumps the
    // claim) and repaints `processing` under the hold, so a single exit
    // stands down on the stale read and leaves that capsule right under
    // the sheet.
    const scope = new DeviceStageBurstScope();
    const token = await scope.beginExplicit({
      connectId: CONNECT_ID,
      vendor: EHardwareVendor.ledger,
    });
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');
    stageAtom.get.mockImplementationOnce(async () => {
      const read = stage;
      await scope.onThirdPartyState({
        ui: {
          action: EThirdPartyHardwareUiAction.processing,
          vendor: EHardwareVendor.ledger,
        },
        install: undefined,
        batch: undefined,
      });
      expect(stage?.step).toBe('processing');
      return read;
    });
    await expect(scope.silence()).resolves.toBe(true);
    expect(stage?.step).toBe('off');
    await scope.endExplicit({ token });
  });

  it('leaves on a call-end close during the firmware workflow even behind a foreign hold', async () => {
    // Onboarding holds across the update page. Its hold must not turn the
    // update's call-end closes into a processing capsule over the page,
    // nor keep the confirm the device just had answered.
    const scope = new DeviceStageBurstScope();
    const token = await scope.beginExplicit({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    firmwareWorkflowAtom.get.mockResolvedValue(true);
    await scope.silence();
    expect(stage?.step).toBe('off');
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('confirm');
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    await letTheExitRun();
    expect(stage?.step).toBe('off');
    firmwareWorkflowAtom.get.mockResolvedValue(false);
    await scope.endExplicit({ token });
  });

  it('keeps a failure the hardware layer never claimed off the stage', async () => {
    // A keyring/vault OneKeyLocalError rides out through the same finally
    // as a device failure. It still owns the legacy toast, so landing it
    // here would say the same internal sentence twice — and the probe
    // would delay the caller ~500ms to ask about a device that is fine.
    const isDeviceStillConnected = jest.fn(async () => true);
    const scope = new DeviceStageBurstScope({ isDeviceStillConnected });
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();

    await scope.end({
      error: new OneKeyLocalError('Unable to build the transaction'),
    });

    expect(isDeviceStillConnected).not.toHaveBeenCalled();
    expect(stage?.step).not.toBe('error');
    // The burst still closes — only the outcome stays out.
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('still lands the outcome for a real hardware failure', async () => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();

    await scope.end({
      error: {
        $isHardwareError: true,
        code: HardwareErrorCode.ActionCancelled,
      },
    });

    expect(stage?.step).toBe('error');
    expect(stage?.errorReason).toBe('rejected');
  });

  it.each([
    HardwareErrorCode.BleDeviceBondError,
    HardwareErrorCode.BlePeerRemovedPairingInformation,
    HardwareErrorCode.BleBondInvalid,
    HardwareErrorCode.DeviceNotOpenedPassphrase,
    HardwareErrorCode.NewFirmwareForceUpdate,
    HardwareErrorCode.BlePermissionError,
    HardwareErrorCode.BleLocationError,
    HardwareErrorCode.BleLocationServicesDisabled,
  ])('leaves the stage when recovery UI owns error %s', async (code) => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();

    await scope.end({
      error: {
        $isHardwareError: true,
        code,
      },
    });

    expect(stage?.step).toBe('off');
  });

  it.each([
    HardwareErrorCode.BleUnavailableWhileUsbConnected,
    HardwareErrorCode.DeviceCheckUnlockTypeError,
    HardwareErrorCode.DeviceCheckPassphraseStateError,
    HardwareErrorCode.DeviceCheckDeviceIdError,
  ])(
    'preserves error details across an explicit holder RPC for %s',
    async (code) => {
      const isDeviceStillConnected = jest.fn(async () => false);
      const scope = new DeviceStageBurstScope({ isDeviceStillConnected });
      const token = await scope.beginExplicit({ connectId: CONNECT_ID });
      await scope.begin({ connectId: CONNECT_ID });
      await paintOpeningBeat();
      const error = convertDeviceError({ code });
      error.info = { version: '5.0.0' };
      await scope.end({ error });
      expect(stage?.step).toBe('connecting');

      // Native requests JSON-encode their arguments. Error.message itself
      // is non-enumerable, so the UI must send the plain error metadata.
      const request = JSON.parse(
        JSON.stringify({ token, error: toPlainErrorObject(error) }),
      ) as { token: number; error: unknown };
      await scope.endExplicit(request);

      expect(stage).toMatchObject({
        step: 'error',
        errorMessage: error.message,
        errorI18n: { key: error.key, info: { version: '5.0.0' } },
      });
      expect(stage?.errorReason).toBeUndefined();
      expect(isDeviceStillConnected).not.toHaveBeenCalled();
      await scope.userClose();
      expect(stage?.errorI18n).toBeUndefined();
    },
  );

  it('releases an explicit holder for the original enable-passphrase dialog', async () => {
    const scope = new DeviceStageBurstScope();
    const token = await scope.beginExplicit({ connectId: CONNECT_ID });
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    const error = convertDeviceError({
      code: HardwareErrorCode.DeviceNotOpenedPassphrase,
    });
    await scope.end({ error });
    await scope.endExplicit({
      token,
      error: JSON.parse(JSON.stringify(toPlainErrorObject(error))) as unknown,
    });
    expect(stage?.step).toBe('off');
  });

  it.each([
    ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb,
    ECustomOneKeyHardwareError.UnknownHardwareError,
  ])(
    'hands error %s to the existing action toast once the outer hold ends',
    async (code) => {
      const scope = new DeviceStageBurstScope();
      const token = await scope.beginExplicit({ connectId: CONNECT_ID });
      await scope.begin({ connectId: CONNECT_ID });
      await paintOpeningBeat();
      const error = Object.assign(new Error('Firmware recovery detail'), {
        $isHardwareError: true,
        code,
        autoToast: false,
        payload: { connectId: CONNECT_ID },
      });
      await scope.end({ error });
      expect(errorToastUtils.showToastOfError).not.toHaveBeenCalled();

      await scope.endExplicit({ token, error: toPlainErrorObject(error) });
      expect(stage?.step).toBe('off');
      expect(errorToastUtils.showToastOfError).toHaveBeenCalledTimes(1);
      expect(errorToastUtils.showToastOfError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: error.message,
          code,
          autoToast: true,
          payload: { connectId: CONNECT_ID },
        }),
      );
      expect(error.autoToast).toBe(false);
    },
  );

  it('does not toast an old failure when a newer flow claims the stage during exit', async () => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    stageAtom.get.mockImplementationOnce(async () => {
      await scope.begin({ connectId: 'NEXT_DEVICE_ID' });
      await scope.noteStep('pinOnApp', { connectId: 'NEXT_DEVICE_ID' });
      return stage;
    });

    await scope.end({
      error: {
        $isHardwareError: true,
        code: ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb,
        message: 'Previous firmware error',
      },
    });

    expect(stage).toMatchObject({
      step: 'pinOnApp',
      connectId: 'NEXT_DEVICE_ID',
    });
    expect(errorToastUtils.showToastOfError).not.toHaveBeenCalled();
  });

  it('preserves a portfolio package rejection after RPC and cleanup', async () => {
    const scope = new DeviceStageBurstScope({
      isDeviceStillConnected: async () => false,
    });
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    const error = convertDeviceError({
      code: HardwareErrorCode.RuntimeError,
      error: 'Failure_DataError,Invalid portfolio package',
    });
    const landedError: unknown = JSON.parse(
      JSON.stringify(toPlainErrorObject(error)),
    );

    await scope.end({ error: landedError });

    expect(stage).toMatchObject({
      step: 'error',
      errorMessage: error.message,
      errorI18n: { key: error.key, info: error.info },
    });
    expect(stage?.errorReason).toBeUndefined();
    expect(errorToastUtils.showToastOfError).not.toHaveBeenCalled();
  });

  it('keeps an unknown transport failure on the disconnected stage when unplugged', async () => {
    const isDeviceStillConnected = jest.fn(async () => false);
    const scope = new DeviceStageBurstScope({ isDeviceStillConnected });
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.end({
      error: convertDeviceError({
        code: HardwareErrorCode.RuntimeError,
        error: 'Protocol V2 USB read failed: transferIn',
      }),
    });
    expect(stage?.step).toBe('error');
    expect(stage?.errorReason).toBe('disconnected');
    expect(errorToastUtils.showToastOfError).not.toHaveBeenCalled();
  });

  it.each([undefined, CONNECT_ID])(
    'hands bootloader errors to recovery only with a device (%s)',
    async (connectId) => {
      const scope = new DeviceStageBurstScope();
      await scope.begin({ connectId: CONNECT_ID });
      await paintOpeningBeat();
      await scope.end({
        error: convertDeviceError({
          code: HardwareErrorCode.NotAllowInBootloaderMode,
          connectId,
        }),
      });
      expect(stage?.step).toBe(connectId ? 'off' : 'error');
    },
  );

  it('hands the stage over between explicit holders without leaking a layer', async () => {
    // The second holder supersedes the first: the first's layer has to
    // leave with its token, or its stale endExplicit releases nothing and
    // the stage stands until the person closes it.
    const scope = new DeviceStageBurstScope();
    const holderA = await scope.beginExplicit({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    const holderB = await scope.beginExplicit({ connectId: CONNECT_ID });
    await paintOpeningBeat();

    await scope.endExplicit({ token: holderA });
    await letTheExitRun();
    expect(stage?.step).toBe('connecting');

    await scope.endExplicit({ token: holderB });
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('lets a follow-up burst keep the stage when the previous exit is already past its read', async () => {
    // The scheduled exit reads the atom, then writes off. A burst that
    // claims the stage between the two — the hidden-wallet follow-up at
    // the edge of the grace window — used to have its opening hidden while
    // its device call ran on without a PIN or confirm surface.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.end();

    let releaseExitRead: (() => void) | undefined;
    stageAtom.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseExitRead = () => resolve(stage);
        }),
    );
    // The exit fires and parks on its read.
    jest.advanceTimersByTime(OFF_GRACE_MS);
    expect(releaseExitRead).toBeDefined();

    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');

    releaseExitRead?.();
    await jest.advanceTimersByTimeAsync(0);
    expect(stage?.step).toBe('connecting');
  });

  it('drops an ask that read the stage before the person closed it', async () => {
    // A queued REQUEST_PIN was already reading the atom when the close
    // landed. Painting it would reopen a stage no burst stands behind — the
    // call it belongs to was cancelled with the close.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();

    let releaseAskRead: (() => void) | undefined;
    stageAtom.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseAskRead = () => resolve(stage);
        }),
    );
    const ask = scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_PIN,
      connectId: CONNECT_ID,
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(releaseAskRead).toBeDefined();

    await scope.userClose();
    expect(stage?.step).toBe('off');

    releaseAskRead?.();
    await ask;
    expect(stage?.step).toBe('off');
  });

  it('keeps an ask on stage when a detached wait note lands after it', async () => {
    // showCheckingDeviceDialog / showDeviceProcessLoadingDialog `void`
    // their notes, so a fast device's REQUEST_PIN can paint first. The
    // late wait must not take the PIN card down: the device is waiting.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_PIN,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('pinOnApp');

    await scope.noteStep('connecting', { connectId: CONNECT_ID });
    expect(stage?.step).toBe('pinOnApp');
    await scope.noteStep('processing', { connectId: CONNECT_ID });
    expect(stage?.step).toBe('pinOnApp');

    // A wait still refreshes a wait, and an ask still lands.
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('processing');
    await scope.noteStep('connecting', { connectId: CONNECT_ID });
    expect(stage?.step).toBe('connecting');
    await scope.noteStep('enterPin', { connectId: CONNECT_ID });
    expect(stage?.step).toBe('enterPin');
  });

  it('holds the wallet-type fork over a late wait and leaves it only by its answer', async () => {
    // Onboarding asks the fork right after a detached processing note
    // (showDeviceProcessLoadingDialog is `void`ed a bridge hop behind):
    // the card is an ask and must not be repainted by that wait. Its own
    // answer, and nothing else, moves the stage back to the wait.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.noteStep('selectWalletType', { connectId: CONNECT_ID });
    expect(stage?.step).toBe('selectWalletType');

    await scope.noteStep('processing', { connectId: CONNECT_ID });
    expect(stage?.step).toBe('selectWalletType');

    await scope.noteWalletTypeSelected();
    expect(stage?.step).toBe('processing');

    // Answered once; a stray second answer touches whatever came next.
    await scope.noteStep('enterPassphrase', { connectId: CONNECT_ID });
    await scope.noteWalletTypeSelected();
    expect(stage?.step).toBe('enterPassphrase');
  });

  it('counts device activity so the container can tell a stalled wait from a busy one', async () => {
    // Account creation runs many short calls inside one held burst with
    // the capsule on `processing` throughout: each call's begin and end
    // must register as activity, or the idle clock would call the busy
    // wait stalled.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    const painted = stage?.activitySeq ?? 0;
    expect(painted).toBeGreaterThan(0);

    await scope.begin({ connectId: CONNECT_ID });
    expect(stage?.activitySeq).toBe(painted + 1);
    await scope.end();
    expect(stage?.activitySeq).toBe(painted + 2);
    expect(stage?.step).toBe('connecting');

    // A repainted wait counts too.
    await scope.noteStep('processing', { connectId: CONNECT_ID });
    expect(stage?.activitySeq).toBe(painted + 3);
  });

  it('leaves the stage to the call that took the device from an interrupted one', async () => {
    // hd-core rejects the call ANOTHER call interrupts with
    // DeviceInterruptedFromOutside. That victim is never the person: its
    // end must not close the stage the new call is now waiting on — the
    // wallet-type fork vanished mid-onboarding this way, and the flow hung
    // on a card no one could answer.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.begin({ connectId: CONNECT_ID });
    await scope.noteStep('selectWalletType', { connectId: CONNECT_ID });

    await scope.end({
      error: {
        $isHardwareError: true,
        code: HardwareErrorCode.DeviceInterruptedFromOutside,
      },
    });
    expect(stage?.step).toBe('selectWalletType');

    // On its own, the same error still lands no outcome — a silent exit.
    await scope.noteWalletTypeSelected();
    await scope.end({
      error: {
        $isHardwareError: true,
        code: HardwareErrorCode.DeviceInterruptedFromOutside,
      },
    });
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('keeps an app-authored card standing over a bystander call-end close', async () => {
    // The device-state read that precedes the fork can deliver its close
    // event after the card is painted; that close belongs to the call
    // that is over, not to the card the person is reading.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.noteStep('selectWalletType', { connectId: CONNECT_ID });
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('selectWalletType');
    await scope.noteWalletTypeSelected();
    expect(stage?.step).toBe('processing');
  });

  it('keeps an app-authored card standing with no burst holding the stage', async () => {
    // Legacy onboarding paints the fork at depth 0: the device-state read
    // before it does not run through a wrapper, so nothing holds the
    // stage. That call's straggling close must not schedule the stage off
    // under a card the person has not answered — the flow would then wait
    // for a choice it has taken away from them.
    const scope = new DeviceStageBurstScope();
    await scope.noteStep('processing', { connectId: CONNECT_ID });
    await scope.noteStep('selectWalletType', { connectId: CONNECT_ID });

    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    await letTheExitRun();
    expect(stage?.step).toBe('selectWalletType');

    // Answered with nothing behind it: the wait stands for the grace, long
    // enough for the flow's first call to rejoin and no longer.
    await scope.noteWalletTypeSelected();
    expect(stage?.step).toBe('processing');
    await letTheExitRun();
    expect(stage?.step).toBe('off');
  });

  it('keeps an app-authored card standing over an answered PIN’s progress beat', async () => {
    // A real PIN window's close reaches the scope rewritten as progress
    // carrying `askCompleted` — the flag that resumes a narrative after
    // the device's own ask was answered. That PIN belongs to the call
    // that ran before the card (the device-state read that decided to
    // ask), so it must not paint Connecting over the question. The stage
    // stays on through such a repaint, so nothing would announce an exit
    // and the flow would wait on a card that is gone.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.noteStep('selectWalletType', { connectId: CONNECT_ID });

    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.ProcessLoading,
      connectId: CONNECT_ID,
      askCompleted: true,
    });
    expect(stage?.step).toBe('selectWalletType');

    // The device asking for something itself still outranks the card: a
    // request nobody can answer would strand the call that made it.
    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.REQUEST_PIN,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('pinOnApp');
  });

  it('keeps an app-authored card standing over an unresolved auth narrative', async () => {
    // An ask painted over a verification beat leaves `authoredAuthStep`
    // set — an ASK step never clears it, and the narrative's own resolver
    // declines to clear it once something else stands on stage. The next
    // call-end close would otherwise put the verification beat back over
    // a question the person is still reading.
    const scope = new DeviceStageBurstScope();
    await scope.beginExplicit({ connectId: CONNECT_ID });
    await scope.begin({ connectId: CONNECT_ID });
    await scope.noteStep('authFailure', { authFailureReason: 'unknown' });
    await scope.noteStep('selectWalletType', { connectId: CONNECT_ID });
    await scope.noteAuthNarrativeResolved();
    expect(stage?.step).toBe('selectWalletType');

    await scope.onHardwareUiEvent({
      action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
      connectId: CONNECT_ID,
    });
    expect(stage?.step).toBe('selectWalletType');
  });

  it('paints no card the firmware workflow claimed mid-flight', async () => {
    // The takeover lands while the enablement read is still in flight:
    // its forceOff has already run and the update page owns the screen,
    // so writing the card here would put it back over that page — and
    // answering `true` would leave the caller waiting on it.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();

    firmwareWorkflowAtom.get.mockImplementationOnce(async () => {
      await scope.silence();
      return false;
    });
    expect(
      await scope.noteStep('selectWalletType', { connectId: CONNECT_ID }),
    ).toBe(false);
    expect(stage?.step).toBe('off');
  });

  it('reports whether an authored card landed', async () => {
    // The caller waits for the card's answer, so it must hear when the
    // card was refused: the firmware workflow raising its flag between the
    // caller's own check and the paint left onboarding waiting forever on
    // a card nobody painted.
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(
      await scope.noteStep('selectWalletType', { connectId: CONNECT_ID }),
    ).toBe(true);

    firmwareWorkflowAtom.get.mockResolvedValue(true);
    expect(
      await scope.noteStep('passphraseIntro', { connectId: CONNECT_ID }),
    ).toBe(false);
    expect(stage?.step).toBe('selectWalletType');
  });

  it('announces every exit so a flow awaiting a card stops waiting', async () => {
    const emit = jest.spyOn(appEventBus, 'emit');
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    await scope.userClose();
    expect(stage?.step).toBe('off');
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.DeviceStageOff,
      undefined,
    );
    emit.mockRestore();
  });

  it('clears a painted stage the moment the firmware workflow takes the screen', async () => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');

    await scope.silence();
    expect(stage?.step).toBe('off');

    // The burst's own bookkeeping still lands on its end.
    firmwareWorkflowAtom.get.mockResolvedValue(true);
    await scope.end();
    expect(burstActiveFlag).toHaveBeenLastCalledWith(false);
    expect(stage?.step).toBe('off');
  });
});

describe('createLatestStateFeed', () => {
  const flush = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

  it('runs one read at a time and once more for the triggers that arrived meanwhile', async () => {
    let release: (() => void) | undefined;
    const run = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const feed = createLatestStateFeed(run);

    feed();
    expect(run).toHaveBeenCalledTimes(1);
    // Three atoms fire for one call boundary: one rerun, not three.
    feed();
    feed();
    feed();
    expect(run).toHaveBeenCalledTimes(1);

    release?.();
    await flush();
    expect(run).toHaveBeenCalledTimes(2);

    release?.();
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps feeding after a read that failed', async () => {
    const run = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('bridge not ready'))
      .mockResolvedValue(undefined);
    const feed = createLatestStateFeed(run);

    feed();
    await flush();
    feed();
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
