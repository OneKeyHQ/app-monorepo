import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';
import { Keyboard } from 'react-native';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageStep } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageVendor } from '@onekeyhq/components/src/composite/DeviceStage/type';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useDeviceStageAtom,
  useDeviceStageEnabledAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IDeviceStageState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { buildThirdPartyHardwareUiResponse } from '../ThirdPartyHardwareUiStateContainer/utils';

/**
 * DeviceStage driver (OK-59934): renders the stage from deviceStageAtom.
 * One permanently mounted instance; every step change morphs in place and
 * only `off` plays the exit — the burst scope in kit-bg guarantees `off`
 * never fires between consecutive requests of one burst.
 *
 * Close-grant policy (design hard rule #3): asks arm the close button after
 * 3s, waits after 10s, authenticity steps and error outcomes immediately;
 * once armed it stays armed for the rest of the burst. `onClose` presence
 * alone is the switch.
 *
 * Two tracks share the container: OneKey responses ride the hd-core
 * uiResponse channel; third-party (Trezor / Ledger) responses ride the
 * adapter channel, routed by the stage state's `vendor` +
 * `thirdPartyAction`.
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

function toStageVendor(
  vendor: IDeviceStageState['vendor'],
): IDeviceStageVendor | undefined {
  if (vendor === EHardwareVendor.trezor || vendor === EHardwareVendor.ledger) {
    return vendor;
  }
  return undefined;
}

function DeviceStageContainerCmp() {
  const [stage] = useDeviceStageAtom();
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const {
    serviceHardwareUI,
    serviceThirdPartyHardware,
    serviceHardware,
    serviceSetting,
  } = backgroundApiProxy;
  const [, setSettings] = useSettingsPersistAtom();

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

  /** Third-party answer path: build the adapter UI response from the
   * original action the stage state carries. Best-effort — the demo
   * scripts run without a live adapter. */
  const sendVendorUiResponse = useCallback(
    (
      confirmed: boolean,
      extras?: Parameters<typeof buildThirdPartyHardwareUiResponse>[2],
    ) => {
      const current = stageRef.current;
      if (!current?.vendor) {
        return;
      }
      const response = buildThirdPartyHardwareUiResponse(
        current.thirdPartyAction,
        confirmed,
        extras,
      );
      if (response) {
        void serviceThirdPartyHardware
          .thirdPartyHardwareUiResponse({
            vendor: current.vendor,
            response,
          })
          .catch(() => undefined);
      } else if (!confirmed) {
        void serviceThirdPartyHardware
          .thirdPartyHardwareCancel({ vendor: current.vendor })
          .catch(() => undefined);
      }
    },
    [serviceThirdPartyHardware],
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    const current = stageRef.current;
    if (current?.vendor && current.step !== 'error') {
      // Third-party cancel semantics: decline the open request when it
      // takes a decline response, otherwise cancel the adapter call.
      sendVendorUiResponse(false);
    }
    // On the error outcome the call is already over (the notice form's
    // self-exit also lands here) — nothing on the device left to cancel.
    void serviceHardwareUI.deviceStageUserClose({
      connectId: current?.connectId,
      skipDeviceCancel: Boolean(current?.vendor) || current?.step === 'error',
    });
  }, [sendVendorUiResponse, serviceHardwareUI]);

  const handlePinSubmit = useCallback(
    (pin: string) => {
      const current = stageRef.current;
      if (current?.vendor) {
        sendVendorUiResponse(true, { pin });
      } else {
        // No active SDK call in demo scripts — the response is best-effort.
        void serviceHardwareUI
          .sendPinToDevice({
            pin,
            responseCorrelation: current?.payload?.uiResponseCorrelation,
          })
          .catch(() => undefined);
      }
      void serviceHardwareUI.deviceStageNoteInputSubmitted();
    },
    [sendVendorUiResponse, serviceHardwareUI],
  );

  /** The hidden wallet's "keep after the app closes" choice — every exit
   * of the create-mode form carries it, and verify mode never writes it
   * (there is no new wallet to keep). */
  const saveKeepAccessible = useCallback(
    (options?: { keepAccessible: boolean }) => {
      if (
        stageRef.current?.passphraseMode !== 'create' ||
        options?.keepAccessible === undefined
      ) {
        return;
      }
      void serviceSetting
        .setHiddenWalletImmediately(options.keepAccessible)
        .catch(() => undefined);
    },
    [serviceSetting],
  );

  const handlePassphraseSubmit = useCallback(
    (passphrase: string, options?: { keepAccessible: boolean }) => {
      const current = stageRef.current;
      saveKeepAccessible(options);
      if (current?.vendor) {
        sendVendorUiResponse(true, {
          passphrase,
          passphraseOnDevice: false,
          save: options?.keepAccessible === true,
        });
      } else {
        void serviceHardwareUI
          .sendPassphraseToDevice({
            passphrase,
            responseCorrelation: current?.payload?.uiResponseCorrelation,
          })
          .catch(() => undefined);
      }
      void serviceHardwareUI.deviceStageNoteInputSubmitted();
    },
    [saveKeepAccessible, sendVendorUiResponse, serviceHardwareUI],
  );

  /** The teach card's single exit; its switch rides the wallet list's
   * Add-hidden-wallet shortcut preference out, like the legacy dialog. */
  const handlePassphraseIntroContinue = useCallback(
    (options: { keepShortcut: boolean }) => {
      setSettings((prev) => ({
        ...prev,
        showAddHiddenInWalletSidebar: options.keepShortcut,
      }));
      void serviceHardwareUI.deviceStagePassphraseIntroContinue();
    },
    [serviceHardwareUI, setSettings],
  );

  /** Attach PIN: the hidden wallet opens by its own device PIN instead of
   * a typed passphrase. The device answers with its PIN request next. */
  const handlePassphraseAttachPin = useCallback(
    (options?: { keepAccessible: boolean }) => {
      saveKeepAccessible(options);
      void serviceHardwareUI
        .showEnterAttachPinOnDeviceDialog({
          responseCorrelation: stageRef.current?.payload?.uiResponseCorrelation,
        })
        .catch(() => undefined);
      void serviceHardwareUI.deviceStageNoteInputSubmitted();
    },
    [saveKeepAccessible, serviceHardwareUI],
  );

  const handleSwitchToDevice = useCallback(
    (options?: { keepAccessible: boolean }) => {
      const current = stageRef.current;
      if (!current) {
        return;
      }
      saveKeepAccessible(options);
      if (current.vendor) {
        // Trezor only — the stage suppresses the switch for the PIN matrix,
        // so this is always the passphrase form's on-device exit.
        sendVendorUiResponse(true, { passphraseOnDevice: true });
        void serviceHardwareUI.deviceStageNoteInputSubmitted();
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
        void serviceHardwareUI.deviceStageNoteInputSubmitted();
      }
    },
    [saveKeepAccessible, sendVendorUiResponse, serviceHardwareUI],
  );

  const handlePairingSubmit = useCallback(
    (code: string) => {
      sendVendorUiResponse(true, { tag: code });
      void serviceHardwareUI.deviceStageNoteInputSubmitted();
    },
    [sendVendorUiResponse, serviceHardwareUI],
  );

  const handleDeviceNotFoundRetry = useCallback(() => {
    sendVendorUiResponse(true);
    void serviceHardwareUI.deviceStageNoteInputSubmitted();
  }, [sendVendorUiResponse, serviceHardwareUI]);

  const handleBtcHighIndexConfirm = useCallback(() => {
    sendVendorUiResponse(true);
    void serviceHardwareUI.deviceStageNoteInputSubmitted();
  }, [sendVendorUiResponse, serviceHardwareUI]);

  const handleInstallConfirm = useCallback(() => {
    const current = stageRef.current;
    if (!current?.vendor) {
      return;
    }
    void serviceHardware
      .thirdPartyHardwareUiResponse({
        vendor: current.vendor,
        response: {
          type: UI_RESPONSE.RECEIVE_INSTALL_APP,
          payload: { confirmed: true },
        },
      })
      .catch(() => undefined);
  }, [serviceHardware]);

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
      vendor={toStageVendor(stage?.vendor)}
      vendorModel={stage?.vendorModel}
      vendorModelName={stage?.vendorModelName}
      appName={stage?.appName}
      installProgress={stage?.installProgress}
      installQueue={stage?.installQueue}
      installActiveIndex={stage?.installActiveIndex}
      btcHighIndexPath={stage?.btcHighIndexPath}
      btcHighIndexAccountIndex={stage?.btcHighIndexAccountIndex}
      errorReason={stage?.errorReason}
      inputError={stage?.inputError}
      passphraseMode={stage?.passphraseMode}
      confirmDetails={stage?.confirmDetails}
      confirmMessage={stage?.confirmMessage}
      confirmDescription={stage?.confirmDescription}
      confirmDescriptionDanger={stage?.confirmDescriptionDanger}
      confirmCount={stage?.confirmCount}
      onClose={closable ? handleClose : undefined}
      onPinSubmit={handlePinSubmit}
      onPassphraseSubmit={handlePassphraseSubmit}
      onPassphraseIntroContinue={handlePassphraseIntroContinue}
      onPassphraseAttachPin={
        // Only when the device actually has an attach-PIN binding — the
        // SDK refuses the mode outright otherwise.
        stage?.payload?.existsAttachPinUser && !stage?.vendor
          ? handlePassphraseAttachPin
          : undefined
      }
      onSwitchToDevice={handleSwitchToDevice}
      onPairingSubmit={handlePairingSubmit}
      onDeviceNotFoundRetry={handleDeviceNotFoundRetry}
      onBtcHighIndexConfirm={handleBtcHighIndexConfirm}
      onInstallConfirm={handleInstallConfirm}
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
