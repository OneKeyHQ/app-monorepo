import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ECustomOneKeyHardwareError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { setDeviceStageBurstActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';

import {
  EHardwareUiStateAction,
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

import type { IDeviceStageState } from '../../states/jotai/atoms';

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
    await scope.silenceForFirmwareWorkflow();

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

  it('clears a painted stage the moment the firmware workflow takes the screen', async () => {
    const scope = new DeviceStageBurstScope();
    await scope.begin({ connectId: CONNECT_ID });
    await paintOpeningBeat();
    expect(stage?.step).toBe('connecting');

    await scope.silenceForFirmwareWorkflow();
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
