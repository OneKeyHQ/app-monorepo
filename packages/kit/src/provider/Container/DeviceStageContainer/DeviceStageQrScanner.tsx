import { useCallback, useRef } from 'react';

import { Haptics, ImpactFeedbackStyle } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';

import { ScanQrCode } from '../../../views/ScanQrCode/components';

import { interpretAirGapScanFrame } from './airGapScanFrame';

/**
 * The live view inside scanQr's viewfinder (OK-59934 §4.6): the legacy
 * scan page's camera + permission flow, re-hosted in the stage card.
 * Mounted only while the step is scanQr, so every visit is a fresh
 * decode session; frames ride the same bg parse the legacy page used
 * (the URDecoder accumulating in bg), and the completed scan answers the
 * pending call through ServiceQrWallet instead of a route callback.
 *
 * Deliberately NOT rejecting on unmount: leaving the step is either the
 * way back to showQr, a surface teardown (an extension popup handing to
 * the expand tab), or a stage close — and the close's cancel semantics
 * already live in deviceStageUserClose.
 */
export function DeviceStageQrScanner({
  sessionId,
}: {
  /** The live session's tag off deviceStageAtom — echoed back with the
   * completed scan so a frame parsed after its session was superseded
   * lands as a no-op in bg, never as the next request's answer. */
  sessionId: number | undefined;
}) {
  const submittedRef = useRef(false);
  const resetPromiseRef = useRef<Promise<void> | undefined>(undefined);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const handleBarCodeScanned = useCallback(async (value: string) => {
    // The empty value is ScanQrCode's unmount cleanup — never an answer.
    if (!value || submittedRef.current) {
      return {};
    }
    // One session reset, awaited by every frame: the bg URDecoder is a
    // module singleton, and no part of this session may reach it before
    // the previous session's parts are gone. A rejected reset (a bridge
    // hiccup) un-caches itself so the next frame retries — a cached
    // rejection would kill the whole visit's frames silently.
    if (!resetPromiseRef.current) {
      resetPromiseRef.current = backgroundApiProxy.serviceScanQRCode
        .resetAnimationData()
        .catch((error) => {
          resetPromiseRef.current = undefined;
          throw error;
        });
    }
    await resetPromiseRef.current;
    const parsed = await backgroundApiProxy.serviceScanQRCode.parse(value, {
      handlers: [EQRCodeHandlerNames.animation],
      qrWalletScene: true,
      autoExecuteParsedAction: false,
    });
    if (submittedRef.current) {
      // A slower frame racing the one that completed the set.
      return {};
    }
    if (parsed.type === EQRCodeHandlerType.ANIMATION_CODE) {
      Haptics.impact(ImpactFeedbackStyle.Light);
    }
    const outcome = interpretAirGapScanFrame(parsed);
    if (outcome.kind === 'progress') {
      return { progress: outcome.progress };
    }
    submittedRef.current = true;
    try {
      await backgroundApiProxy.serviceQrWallet.submitStageAirGapScanResult({
        result: outcome.result,
        sessionId: sessionIdRef.current,
      });
    } catch {
      // A rejected submit (a bridge hiccup) must not end the visit: the bg
      // decoder is complete, so the next frame re-delivers the same result
      // and gets to submit again. Two gates stand in its way — this one,
      // and ScanQrCode's same-frame filter, which a static code (one frame,
      // always the same bytes) would never get past on its own — so the
      // retry is signalled to the host as well as reset here.
      submittedRef.current = false;
      return { retry: true };
    }
    return {};
  }, []);
  return (
    <ScanQrCode
      handleBarCodeScanned={handleBarCodeScanned}
      // The scene's blur is a privacy layer, not decoration: it keeps the
      // device's answer code out of screenshots and screen recordings —
      // decoding reads raw camera frames, so the scan works through it.
      // Same coverage as the legacy full-screen page (native Android
      // excepted, as there).
      qrWalletScene
      disableNavigationGuard
    />
  );
}
