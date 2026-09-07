import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';
import { Keyboard } from 'react-native';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageStep } from '@onekeyhq/components/src/composite/DeviceStage';
import type {
  IDeviceStageConnectionType,
  IDeviceStageVendor,
  IDeviceStageWalletType,
} from '@onekeyhq/components/src/composite/DeviceStage/type';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import { useBackHandler } from '@onekeyhq/components/src/hooks';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
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
  DEVICE_STAGE_EXIT_SETTLE_MS,
  attachDeviceStageEscapeOwner,
  isDeviceStageAnsweredStep,
  isDeviceStageMachineWaitStep,
  resolveDeviceStageBackPress,
  resolveDeviceStageExitGrant,
  resolveDeviceStageWaitStall,
} from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import type { IDeviceStageKeyEventTargetLike } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { buildThirdPartyHardwareUiResponse } from '../ThirdPartyHardwareUiStateContainer/utils';

import { DeviceStageQrScanner } from './DeviceStageQrScanner';

/**
 * DeviceStage driver (OK-59934): renders the stage from deviceStageAtom.
 * One permanently mounted instance; every step change morphs in place and
 * only `off` plays the exit — the burst scope in kit-bg guarantees `off`
 * never fires between consecutive requests of one burst.
 *
 * Exit policy (design hard rule #3, see resolveDeviceStageExitGrant): an
 * ask opens every exit once the stage has settled for a second after
 * appearing; a wait on the machine shows its close only once THIS wait
 * has stalled — the device silent for ten seconds, or the wait past
 * thirty whatever the chatter — and after the person answered a card the
 * keys wait for that stall too; outcomes and decisions open at once; the
 * ✓ never closes. `onClose` presence alone is the switch.
 *
 * Two tracks share the container: OneKey responses ride the hd-core
 * uiResponse channel; third-party (Trezor / Ledger) responses ride the
 * adapter channel, routed by the stage state's `vendor` +
 * `thirdPartyAction`.
 */

type IDeviceStageExitVia = 'close' | 'escape' | 'back';

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
  const [settings, setSettings] = useSettingsPersistAtom();

  const step: IDeviceStageStep = (stage?.step as IDeviceStageStep) ?? 'off';
  const isVendorTrack = Boolean(stage?.vendor);

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

  // The exit policy's clocks (design hard rule #3). The settle clock runs
  // once per appearance of the stage — `appearance` counts the off → on
  // crossings. The stall clock runs once per continuous machine wait —
  // `waitRun` counts the entries into the capsule waits, so connecting →
  // processing stays in one run while a card in between starts the next,
  // and a run that begins right after an answered card is marked so the
  // keys hold with the close. A wait stalls when the device has been
  // silent for the idle time (every beat, hardware call and SDK event
  // bumps the state's activitySeq) or, whatever the chatter, when the run
  // has reached its cap — see resolveDeviceStageWaitStall. Render-time
  // ref writes on purpose: the grant must read a crossing in the very
  // render that shows the new step, or a close would flash for a frame.
  const activitySeq = stage?.activitySeq ?? 0;
  const exitRef = useRef({
    prevStep: 'off' as IDeviceStageStep,
    appearance: 0,
    appearedAt: 0,
    waitRun: 0,
    waitRunStartedAt: 0,
    waitRunStep: 'off' as IDeviceStageStep,
    afterAnswer: false,
    lastActivitySeq: 0,
    lastActivityAt: 0,
    endedWaitRun: undefined as
      | {
          waitRun: number;
          step: IDeviceStageStep;
          durationMs: number;
          afterAnswer: boolean;
          endedBy: 'next' | 'off';
        }
      | undefined,
  });
  const exit = exitRef.current;
  if (exit.prevStep !== step) {
    const now = Date.now();
    if (exit.prevStep === 'off') {
      exit.appearance += 1;
      exit.appearedAt = now;
    }
    const wasWaiting = isDeviceStageMachineWaitStep(exit.prevStep);
    const isWaiting = isDeviceStageMachineWaitStep(step);
    if (wasWaiting && !isWaiting) {
      exit.endedWaitRun = {
        waitRun: exit.waitRun,
        step: exit.waitRunStep,
        durationMs: now - exit.waitRunStartedAt,
        afterAnswer: exit.afterAnswer,
        endedBy: step === 'off' ? 'off' : 'next',
      };
    }
    if (isWaiting && !wasWaiting) {
      exit.waitRun += 1;
      exit.waitRunStartedAt = now;
      exit.lastActivityAt = now;
      exit.afterAnswer = isDeviceStageAnsweredStep(exit.prevStep);
    }
    if (isWaiting) {
      exit.waitRunStep = step;
    }
    exit.prevStep = step;
  }
  if (activitySeq !== exit.lastActivitySeq) {
    // The device spoke — a call began or ended, an SDK event landed: the
    // idle clock starts over while the cap keeps counting.
    exit.lastActivitySeq = activitySeq;
    exit.lastActivityAt = Date.now();
  }
  const { appearance, waitRun, afterAnswer } = exit;
  const stageOn = step !== 'off';
  const machineWait = isDeviceStageMachineWaitStep(step);
  const [settledAppearance, setSettledAppearance] = useState(0);
  const [stalledWaitRun, setStalledWaitRun] = useState(0);
  useEffect(() => {
    if (!stageOn || settledAppearance === appearance) {
      return undefined;
    }
    const timer = setTimeout(
      () => setSettledAppearance(appearance),
      Math.max(
        0,
        DEVICE_STAGE_EXIT_SETTLE_MS - (Date.now() - exitRef.current.appearedAt),
      ),
    );
    return () => clearTimeout(timer);
  }, [stageOn, appearance, settledAppearance]);
  useEffect(() => {
    if (!machineWait || stalledWaitRun === waitRun) {
      return undefined;
    }
    // Re-armed on every sign of life (activitySeq): the idle deadline
    // moves, the cap does not.
    const clocks = exitRef.current;
    const { stalled: due, dueInMs } = resolveDeviceStageWaitStall({
      now: Date.now(),
      waitStartedAt: clocks.waitRunStartedAt,
      lastActivityAt: clocks.lastActivityAt,
    });
    if (due) {
      setStalledWaitRun(waitRun);
      return undefined;
    }
    const timer = setTimeout(() => setStalledWaitRun(waitRun), dueInMs);
    return () => clearTimeout(timer);
  }, [machineWait, waitRun, stalledWaitRun, activitySeq]);
  const settled = settledAppearance === appearance;
  const stalled = machineWait && stalledWaitRun === waitRun;
  const stalledRef = useRef(stalled);
  stalledRef.current = stalled;
  const { closable, exitAllowed } = resolveDeviceStageExitGrant({
    step,
    settled,
    stalled,
    afterAnswer,
  });
  // The wait that just ended, reported once its successor has rendered.
  useEffect(() => {
    const ended = exitRef.current.endedWaitRun;
    if (!ended) {
      return;
    }
    exitRef.current.endedWaitRun = undefined;
    defaultLogger.hardware.connection.deviceStageWaitEnded({
      step: ended.step,
      transport: connectionType,
      vendor: stageRef.current?.vendor,
      durationMs: ended.durationMs,
      stalled: stalledWaitRun === ended.waitRun,
      afterAnswer: ended.afterAnswer,
      endedBy: ended.endedBy,
    });
  }, [step, connectionType, stalledWaitRun]);

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
    (via: IDeviceStageExitVia) => {
      Keyboard.dismiss();
      const current = stageRef.current;
      const clocks = exitRef.current;
      const onWait = isDeviceStageMachineWaitStep(current?.step ?? 'off');
      defaultLogger.hardware.connection.deviceStageClosed({
        step: current?.step ?? 'off',
        via,
        transport: connectionType,
        vendor: current?.vendor,
        sinceAppearanceMs: Date.now() - clocks.appearedAt,
        sinceWaitMs: onWait ? Date.now() - clocks.waitRunStartedAt : undefined,
        stalled: onWait && stalledRef.current,
        afterAnswer: onWait && clocks.afterAnswer,
      });
      if (current?.vendor && current.step !== 'error') {
        // Third-party cancel semantics: decline the open request when it
        // takes a decline response, otherwise cancel the adapter call.
        sendVendorUiResponse(false);
      }
      // On the error outcome the call is already over (the notice form's
      // self-exit also lands here); on the teach card nothing has started
      // yet; on the wallet-type fork the call that read the device is already
      // over; on the Device-not-connected card there is no device at all.
      // None of them leaves anything on the device to cancel.
      void serviceHardwareUI.deviceStageUserClose({
        connectId: current?.connectId,
        skipDeviceCancel:
          Boolean(current?.vendor) ||
          current?.step === 'error' ||
          current?.step === 'passphraseIntro' ||
          current?.step === 'selectWalletType' ||
          current?.step === 'deviceNotFound',
      });
    },
    [connectionType, sendVendorUiResponse, serviceHardwareUI],
  );
  const handleClose = useCallback(() => handleExit('close'), [handleExit]);

  // Android back (and Escape below) while the stage is up: the close once
  // the exit is allowed, swallowed before that — never the screen
  // underneath, which the stage's wall already hides. See
  // resolveDeviceStageBackPress.
  const handleBackPress = useCallback(
    (via: IDeviceStageExitVia = 'back') => {
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
  useBackHandler(handleBackPress, platformEnv.isNative && step !== 'off');
  // Web / desktop: Escape, owned in the capture phase. The shared hook only
  // calls back and never consumes the key, so the Dialog keydown handlers
  // and the modal navigator's keyup handler underneath would still see the
  // press and close what the stage covers. Attached once; the refs keep it
  // reading the live step and the live decision.
  const stageIsOnRef = useRef(step !== 'off');
  stageIsOnRef.current = step !== 'off';
  const handleBackPressRef = useRef(handleBackPress);
  handleBackPressRef.current = handleBackPress;
  useEffect(() => {
    if (
      platformEnv.isNative ||
      typeof globalThis.addEventListener !== 'function'
    ) {
      return undefined;
    }
    return attachDeviceStageEscapeOwner({
      target: globalThis as unknown as IDeviceStageKeyEventTargetLike,
      isStageOn: () => stageIsOnRef.current,
      onEscape: () => {
        handleBackPressRef.current('escape');
      },
    });
  }, []);

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
      void serviceHardwareUI.deviceStageNoteInputSubmitted();
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
      waitStalled={stalled && step === 'connecting' && !isVendorTrack}
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
      authChecklist={stage?.authChecklist}
      authFailureReason={stage?.authFailureReason}
      authFailureMessage={stage?.authFailureMessage}
      authFailureCode={stage?.authFailureCode}
      onAuthSupport={handleAuthSupport}
      onAuthRetry={handleAuthRetry}
      onAuthContinueAnyway={handleAuthContinueAnyway}
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
