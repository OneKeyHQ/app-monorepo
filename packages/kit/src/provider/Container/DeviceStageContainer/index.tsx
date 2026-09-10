import { memo, useCallback, useRef } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';
import { Keyboard } from 'react-native';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageStep } from '@onekeyhq/components/src/composite/DeviceStage';
import type {
  IDeviceStageConnectionType,
  IDeviceStageVendor,
  IDeviceStageWalletType,
} from '@onekeyhq/components/src/composite/DeviceStage/type';
import {
  useDeviceStageEscapeOwner,
  useDeviceStageExitPolicy,
} from '@onekeyhq/components/src/composite/DeviceStage/useDeviceStageExitPolicy';
import type { IDeviceStageWaitEnd } from '@onekeyhq/components/src/composite/DeviceStage/useDeviceStageExitPolicy';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import { useBackHandler } from '@onekeyhq/components/src/hooks';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useDevSettingsPersistAtom,
  useDeviceStageAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IDeviceStageState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HARDWARE_TROUBLESHOOTING_URL } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  isDeviceStageMachineWaitStep,
  resolveDeviceStageBackPress,
} from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IDeviceStageExitViaValue } from '@onekeyhq/shared/types/deviceStage';

import { buildThirdPartyHardwareUiResponse } from '../ThirdPartyHardwareUiStateContainer/utils';

import { DeviceStageQrScanner } from './DeviceStageQrScanner';

/**
 * DeviceStage driver (OK-59934): renders the stage from deviceStageAtom.
 * One permanently mounted instance; every step change morphs in place and
 * only `off` plays the exit — the burst scope in kit-bg guarantees `off`
 * never fires between consecutive requests of one burst.
 *
 * Exit policy (design hard rule #3): the rule is resolveDeviceStageExitGrant
 * in shared, its clocks run in useDeviceStageExitPolicy. `onClose`
 * presence alone is the switch.
 *
 * Two tracks share the container: OneKey responses ride the hd-core
 * uiResponse channel; third-party (Trezor / Ledger) responses ride the
 * adapter channel, routed by the stage state's `vendor` +
 * `thirdPartyAction`.
 */

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
  const [devSettings] = useDevSettingsPersistAtom();
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const {
    serviceHardwareUI,
    serviceThirdPartyHardware,
    serviceHardware,
    serviceSetting,
  } = backgroundApiProxy;
  const [settings, setSettings] = useSettingsPersistAtom();

  const step: IDeviceStageStep = (stage?.step as IDeviceStageStep) ?? 'off';

  // Channel badge (design hard rule: BLE waits must declare the channel).
  // Same source and formula as the legacy CommonDeviceLoading dialog: the
  // persisted transport type is written back on every SDK transport commit,
  // so it names the channel the current call runs on — native is BLE-only,
  // web/ext transports are all USB-class, only desktop Mac/Win can flip.
  const connectionType: IDeviceStageConnectionType =
    platformEnv.isNative ||
    (platformEnv.isSupportDesktopBle &&
      settings.hardwareTransportType === EHardwareTransportType.DesktopWebBle)
      ? 'bluetooth'
      : 'usb';

  // The exit policy's clocks, and the wait report that rides out of them
  // with the numbers the grant saw.
  const handleWaitEnded = useCallback(
    (ended: IDeviceStageWaitEnd) => {
      defaultLogger.hardware.connection.deviceStageWaitEnded({
        ...ended,
        transport: connectionType,
        vendor: stageRef.current?.vendor,
      });
    },
    [connectionType],
  );
  const { closable, exitAllowed, stalled, clocksRef } =
    useDeviceStageExitPolicy({
      step,
      activitySeq: stage?.activitySeq,
      onWaitEnded: handleWaitEnded,
    });

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

  const handleExit = useCallback(
    (via: IDeviceStageExitViaValue) => {
      Keyboard.dismiss();
      const current = stageRef.current;
      const clocks = clocksRef.current;
      const onWait = isDeviceStageMachineWaitStep(current?.step ?? 'off');
      defaultLogger.hardware.connection.deviceStageClosed({
        step: current?.step ?? 'off',
        via,
        transport: connectionType,
        vendor: current?.vendor,
        sinceAppearanceMs: Date.now() - clocks.appearedAt,
        sinceWaitMs: onWait ? Date.now() - clocks.waitStartedAt : undefined,
        stalled,
        afterAnswer: onWait && clocks.afterAnswer,
      });
      if (current?.vendor && current.step !== 'error') {
        // Third-party cancel semantics: decline the open request when it
        // takes a decline response, otherwise cancel the adapter call.
        sendVendorUiResponse(false);
      }
      // Whether a device call is left to cancel is decided behind the
      // close, from the step it closes (shouldCancelDeviceOnStageClose).
      void serviceHardwareUI.deviceStageUserClose({
        connectId: current?.connectId,
      });
    },
    [
      clocksRef,
      connectionType,
      stalled,
      sendVendorUiResponse,
      serviceHardwareUI,
    ],
  );
  const handleClose = useCallback(() => handleExit('close'), [handleExit]);

  // Android back (and Escape) while the stage is up: the close once the
  // exit is allowed, swallowed before that — never the screen underneath,
  // which the stage's wall already hides. See resolveDeviceStageBackPress.
  const handleBackPress = useCallback(
    (via: IDeviceStageExitViaValue) => {
      const outcome = resolveDeviceStageBackPress({
        stageIsOn: step !== 'off',
        exitAllowed,
      });
      if (outcome === 'pass') {
        return false;
      }
      if (outcome === 'close') {
        handleExit(via);
      }
      return true;
    },
    [step, exitAllowed, handleExit],
  );
  // One subscription for the stage's whole life; the ref hands the native
  // BackHandler and the Escape owner the live decision.
  const handleBackPressRef = useRef(handleBackPress);
  handleBackPressRef.current = handleBackPress;
  const handleNativeBackPress = useCallback(
    () => handleBackPressRef.current('back'),
    [],
  );
  useBackHandler(handleNativeBackPress, platformEnv.isNative && step !== 'off');
  const handleEscape = useCallback(() => {
    handleBackPressRef.current('escape');
  }, []);
  useDeviceStageEscapeOwner({
    stageOn: step !== 'off',
    onEscape: handleEscape,
  });

  const handlePinSubmit = useCallback(
    (pin: string) => {
      const current = stageRef.current;
      if (current?.vendor) {
        sendVendorUiResponse(true, { pin });
      } else {
        // Fire-and-forget on purpose, and not only because the gallery's
        // demo scripts run these steps with no SDK instance: hd-core's
        // `uiResponse` is a synchronous void, so a resolved promise would
        // not mean the device received the PIN. The one rejection this can
        // raise is a missing active SDK instance, which only happens when
        // the call is already being torn down — the wrapper's end() then
        // repaints the stage with an error outcome. A wrong PIN comes back
        // as the SDK rejecting the call with PinInvalid, not from here.
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

  /** The enterPin card's switch back to app entry (OK-61489): persist
   * the preference for the NEXT request — the in-flight one still ends
   * on the device, so nothing is answered here and no input-submitted
   * note is due. A rejection must reach the component: it keeps the
   * entry line up for another try instead of showing the set-to-app
   * banner. */
  const handleSwitchPinInputToApp = useCallback(async () => {
    const connectId = stageRef.current?.connectId;
    if (!connectId) {
      throw new OneKeyLocalError(
        'PIN input switch without a device identity on stage',
      );
    }
    await serviceHardware.setInputPinOnSoftwareByConnectId({
      connectId,
      inputPinOnSoftware: true,
    });
  }, [serviceHardware]);

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
      void serviceHardwareUI.deviceStageNoteInputSubmitted({
        hostPassphraseEntered: passphrase.length > 0,
      });
    },
    [saveKeepAccessible, sendVendorUiResponse, serviceHardwareUI],
  );

  /** The teach card's single exit; its switch rides the wallet list's
   * Add-hidden-wallet shortcut preference out, like the legacy dialog.
   * The event hands control back to the flow that primed the card — it
   * starts the hardware call only after the teaching is read. */
  const handlePassphraseIntroContinue = useCallback(
    (options: { keepShortcut: boolean }) => {
      setSettings((prev) => ({
        ...prev,
        showAddHiddenInWalletSidebar: options.keepShortcut,
      }));
      void serviceHardwareUI.deviceStagePassphraseIntroContinue();
      appEventBus.emit(
        EAppEventBusNames.DeviceStagePassphraseIntroContinue,
        undefined,
      );
    },
    [serviceHardwareUI, setSettings],
  );

  /** The wallet-creation fork's answer: the stage goes back to its wait,
   * and the event hands the choice to the flow that put the card up (the
   * onboarding creation awaiting it), the teach card's own shape. */
  const handleSelectWalletType = useCallback(
    (walletType: IDeviceStageWalletType) => {
      void serviceHardwareUI.deviceStageSelectWalletType();
      appEventBus.emit(EAppEventBusNames.DeviceStageWalletTypeSelected, {
        walletType,
      });
    },
    [serviceHardwareUI],
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

  // The OneKey-track Device-not-connected card mirrors the legacy dialog
  // verbatim (doc §4.1): the same article, the same Intercom entry.
  const handleDeviceNotFoundTroubleshoot = useCallback(() => {
    openUrlExternal(HARDWARE_TROUBLESHOOTING_URL);
  }, []);

  const handleDeviceNotFoundSupport = useCallback(() => {
    void showIntercom();
  }, []);

  // Air-gap pair (doc §4.6): Next and the way back walk the two steps in
  // bg; the completed scan answers through ServiceQrWallet from inside
  // the viewfinder itself. The camera mounts only while the step is
  // scanQr — every visit a fresh session, no idle camera behind a
  // parked panel.
  const handleQrNext = useCallback(() => {
    void serviceHardwareUI.deviceStageQrProceedToScan();
  }, [serviceHardwareUI]);
  const handleQrBack = useCallback(() => {
    void serviceHardwareUI.deviceStageQrBackToShow();
  }, [serviceHardwareUI]);

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

  // The authenticity card's exits travel back to whoever is running the
  // check — it owns the sequence and the result contract, the stage only
  // shows the beats.
  const emitAuthAction = useCallback(
    (action: 'retry' | 'support' | 'continueAnyway') => {
      appEventBus.emit(EAppEventBusNames.DeviceStageAuthAction, { action });
    },
    [],
  );
  const handleAuthSupport = useCallback(
    () => emitAuthAction('support'),
    [emitAuthAction],
  );
  const handleAuthRetry = useCallback(
    () => emitAuthAction('retry'),
    [emitAuthAction],
  );
  const handleAuthContinueAnyway = useCallback(
    () => emitAuthAction('continueAnyway'),
    [emitAuthAction],
  );

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
      connectionType={connectionType}
      waitStalled={stalled}
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
      errorMessage={stage?.errorMessage}
      errorI18n={stage?.errorI18n}
      authChecklist={stage?.authChecklist}
      authFailureReason={stage?.authFailureReason}
      authFailureMessage={stage?.authFailureMessage}
      authFailureCode={stage?.authFailureCode}
      onAuthSupport={handleAuthSupport}
      onAuthRetry={handleAuthRetry}
      onAuthContinueAnyway={handleAuthContinueAnyway}
      allowAuthDevSkip={devSettings.enabled}
      inputError={stage?.inputError}
      passphraseMode={stage?.passphraseMode}
      passphraseAllowUtf8={
        // Same key the legacy dialog used: only the wallet-session
        // coordinator's requests reach a protocol V2 device, and those
        // take NFKD UTF-8 instead of printable ASCII.
        stage?.payload?.source === 'wallet-session-coordinator'
      }
      passphraseKeepAccessible={
        // The remembered Keep-accessible choice, read the way the legacy
        // dialog seeded its form (unset means ON). Hardcoding ON would
        // hand Confirm an ON to persist over a stored OFF — a wallet the
        // person asked to forget would then survive a restart.
        settings.hiddenWalletImmediately ?? true
      }
      confirmDetails={stage?.confirmDetails}
      confirmMessage={stage?.confirmMessage}
      confirmDescription={stage?.confirmDescription}
      confirmDescriptionDanger={stage?.confirmDescriptionDanger}
      confirmCount={stage?.confirmCount}
      qrValueUr={stage?.qrValueUr}
      qrScannerView={
        step === 'scanQr' ? (
          <DeviceStageQrScanner sessionId={stage?.qrSessionId} />
        ) : undefined
      }
      onQrNext={handleQrNext}
      onQrBack={handleQrBack}
      onClose={closable ? handleClose : undefined}
      onPinSubmit={handlePinSubmit}
      onSwitchPinInputToApp={
        // Eligibility is stamped bg-side on the on-device route only
        // (stored record + button device + firmware support + plain
        // PIN, per design hard rule #13); the app-pad hop reuses the
        // REQUEST_PIN payload and so never carries the flag.
        stage?.payload?.pinSwitchToAppAvailable && !stage?.vendor
          ? handleSwitchPinInputToApp
          : undefined
      }
      onPassphraseSubmit={handlePassphraseSubmit}
      onSelectWalletType={handleSelectWalletType}
      onPassphraseIntroContinue={handlePassphraseIntroContinue}
      passphraseIntroKeepShortcut={
        // The remembered wallet-list preference; the legacy dialog read
        // it live, and the card must too — a hardcoded ON would hand
        // Continue an ON to commit over a stored OFF.
        settings.showAddHiddenInWalletSidebar ?? true
      }
      onPassphraseAttachPin={
        // Only when the device actually has an attach-PIN binding — the
        // SDK refuses the mode outright otherwise.
        stage?.payload?.existsAttachPinUser && !stage?.vendor
          ? handlePassphraseAttachPin
          : undefined
      }
      onSwitchToDevice={handleSwitchToDevice}
      onPairingSubmit={handlePairingSubmit}
      onDeviceNotFoundRetry={
        // The vendor card is the adapter's live retry ask; the OneKey
        // card is an outcome mirroring the legacy Device-not-connected
        // dialog — two links, no retry (doc §4.1).
        stage?.vendor ? handleDeviceNotFoundRetry : undefined
      }
      onDeviceNotFoundTroubleshoot={
        stage?.vendor ? undefined : handleDeviceNotFoundTroubleshoot
      }
      onDeviceNotFoundSupport={
        stage?.vendor ? undefined : handleDeviceNotFoundSupport
      }
      onBtcHighIndexConfirm={handleBtcHighIndexConfirm}
      onInstallConfirm={handleInstallConfirm}
    />
  );
}

function BasicDeviceStageContainer() {
  return <DeviceStageContainerCmp />;
}

export const DeviceStageContainer = memo(BasicDeviceStageContainer);
