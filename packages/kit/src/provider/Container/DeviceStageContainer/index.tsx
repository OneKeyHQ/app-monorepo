import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Keyboard } from 'react-native';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageStep } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useDeviceStageAtom,
  useDeviceStageEnabledAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IDeviceStageState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

/**
 * DeviceStage driver (OK-59934): renders the stage from deviceStageAtom.
 * One permanently mounted instance; every step change morphs in place and
 * only `off` plays the exit — the burst scope in kit-bg guarantees `off`
 * never fires between consecutive requests of one burst.
 *
 * Close-grant policy (design hard rule #3): asks arm the close button after
 * 3s, waits after 10s, authenticity steps immediately; once armed it stays
 * armed for the rest of the burst. `onClose` presence alone is the switch.
 */

const CLOSE_ARM_ASK_MS = 3000;
const CLOSE_ARM_WAIT_MS = 10_000;
const WAIT_STEPS = new Set<IDeviceStageStep>(['connecting', 'processing']);
const AUTH_STEPS = new Set<IDeviceStageStep>([
  'genuineCheck',
  'authVerifying',
  'authSuccess',
  'authFailure',
]);

const KNOWN_DEVICE_TYPES = new Set<IHardwareDeviceType>([
  'unknown',
  'classic',
  'classic1s',
  'classicpure',
  'mini',
  'touch',
  'pro',
  'pro2',
  'neo',
]);

function toStageDeviceType(
  deviceType: IDeviceStageState['deviceType'],
): IHardwareDeviceType | undefined {
  if (!deviceType) {
    return undefined;
  }
  return KNOWN_DEVICE_TYPES.has(deviceType as IHardwareDeviceType)
    ? (deviceType as IHardwareDeviceType)
    : 'unknown';
}

function DeviceStageContainerCmp() {
  const [stage] = useDeviceStageAtom();
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const { serviceHardwareUI } = backgroundApiProxy;

  const step: IDeviceStageStep = (stage?.step as IDeviceStageStep) ?? 'off';
  const burstId = stage?.burstId ?? 0;

  // Close grant: armed per burst, sticky until the burst leaves. The
  // authenticity flow arms at once; so does the error outcome — its
  // notice form leaves by itself THROUGH onClose after a readable hold,
  // so the grant must already be there when the step lands.
  const [armedBurstId, setArmedBurstId] = useState(0);
  const closable = step !== 'off' && armedBurstId === burstId;
  useEffect(() => {
    if (step === 'off' || closable) {
      return undefined;
    }
    if (AUTH_STEPS.has(step) || step === 'error') {
      setArmedBurstId(burstId);
      return undefined;
    }
    const timer = setTimeout(
      () => setArmedBurstId(burstId),
      WAIT_STEPS.has(step) ? CLOSE_ARM_WAIT_MS : CLOSE_ARM_ASK_MS,
    );
    return () => clearTimeout(timer);
  }, [step, burstId, closable]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    // On the error outcome the call is already over (the notice form's
    // self-exit also lands here) — nothing on the device left to cancel.
    void serviceHardwareUI.deviceStageUserClose({
      connectId: stageRef.current?.connectId,
      skipDeviceCancel: stageRef.current?.step === 'error',
    });
  }, [serviceHardwareUI]);

  const handlePinSubmit = useCallback(
    (pin: string) => {
      // No active SDK call in demo scripts — the response is best-effort.
      void serviceHardwareUI
        .sendPinToDevice({
          pin,
          responseCorrelation: stageRef.current?.payload?.uiResponseCorrelation,
        })
        .catch(() => undefined);
      void serviceHardwareUI.deviceStageNoteInputSubmitted();
    },
    [serviceHardwareUI],
  );

  const handlePassphraseSubmit = useCallback(
    (passphrase: string) => {
      void serviceHardwareUI
        .sendPassphraseToDevice({
          passphrase,
          responseCorrelation: stageRef.current?.payload?.uiResponseCorrelation,
        })
        .catch(() => undefined);
      void serviceHardwareUI.deviceStageNoteInputSubmitted();
    },
    [serviceHardwareUI],
  );

  const handleSwitchToDevice = useCallback(() => {
    const current = stageRef.current;
    if (!current) {
      return;
    }
    if (current.step === 'pinOnApp') {
      void serviceHardwareUI.sendEnterPinOnDeviceEvent({
        connectId: current.connectId ?? '',
        payload: current.payload,
      });
      return;
    }
    if (current.step === 'passphraseOnApp') {
      void serviceHardwareUI.showEnterPassphraseOnDeviceDialog({
        responseCorrelation: current.payload?.uiResponseCorrelation,
      });
    }
  }, [serviceHardwareUI]);

  // Errors play the notice form by default (no onErrorAction): the ✗
  // capsule informs and leaves on its own through the close grant above.
  // The ask form (retry / reconnect) is granted per flow, only where an
  // honest retry exists — wired when those flows land.

  // DeviceStage (via MorphOverlay) portals itself into the
  // HARDWARE_UI_STATE_DIALOG viewport — no wrapper portal here.
  return (
    <DeviceStage
      step={step}
      deviceType={toStageDeviceType(stage?.deviceType)}
      deviceName={stage?.deviceName}
      errorReason={stage?.errorReason}
      inputError={stage?.inputError}
      passphraseMode={stage?.passphraseMode}
      confirmDetails={stage?.confirmDetails}
      confirmMessage={stage?.confirmMessage}
      confirmDescription={stage?.confirmDescription}
      onClose={closable ? handleClose : undefined}
      onPinSubmit={handlePinSubmit}
      onPassphraseSubmit={handlePassphraseSubmit}
      onSwitchToDevice={handleSwitchToDevice}
    />
  );
}

function BasicDeviceStageContainer() {
  const [enabled] = useDeviceStageEnabledAtom();
  if (!enabled) {
    return null;
  }
  return <DeviceStageContainerCmp />;
}

export const DeviceStageContainer = memo(BasicDeviceStageContainer);
