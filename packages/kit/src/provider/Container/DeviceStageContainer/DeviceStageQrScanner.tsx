import { useCallback, useEffect, useRef } from 'react';

import { Haptics, ImpactFeedbackStyle } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';

import { ScanQrCode } from '../../../views/ScanQrCode/components';
import { isInvalidQrCodeError } from '../../../views/ScanQrCode/utils/isInvalidQrCodeError';

import { interpretAirGapScanFrame } from './airGapScanFrame';

type IStageScanSubmission = Parameters<
  typeof backgroundApiProxy.serviceQrWallet.submitStageAirGapScanResult
>[0];

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
  const pendingSubmissionRef = useRef<IStageScanSubmission>(undefined);
  const resetPromiseRef = useRef<Promise<void> | undefined>(undefined);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  const submitResult = useCallback(async (submission: IStageScanSubmission) => {
    submittedRef.current = true;
    pendingSubmissionRef.current = submission;
    try {
      await backgroundApiProxy.serviceQrWallet.submitStageAirGapScanResult(
        submission,
      );
      pendingSubmissionRef.current = undefined;
    } catch {
      // The next camera frame can retry this result even if the UR advances.
      submittedRef.current = false;
      return { retry: true };
    }
    return {};
  }, []);
  const handleBarCodeScanned = useCallback(
    async (value: string) => {
      if (!value || submittedRef.current || unmountedRef.current) {
        return {};
      }
      if (pendingSubmissionRef.current) {
        return submitResult(pendingSubmissionRef.current);
      }
      const scanSessionId = sessionIdRef.current;
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
      // A frame that outlived this scanner must not reach the next session's decoder.
      if (unmountedRef.current) {
        return {};
      }
      let parsed: Awaited<
        ReturnType<typeof backgroundApiProxy.serviceScanQRCode.parse>
      >;
      try {
        parsed = await backgroundApiProxy.serviceScanQRCode.parse(value, {
          handlers: [EQRCodeHandlerNames.animation],
          qrWalletScene: true,
          autoExecuteParsedAction: false,
        });
      } catch (error) {
        if (unmountedRef.current) {
          return {};
        }
        // Anything but an unacceptable code is a transient failure (a bridge
        // hiccup): retry the frame, as a rejected submit does below.
        if (!isInvalidQrCodeError(error)) {
          return { retry: true };
        }
        // A code the scan can never accept (its error toasts itself): end the
        // scan rather than fail every further frame of the same code.
        if (!submittedRef.current) {
          submittedRef.current = true;
          await backgroundApiProxy.serviceQrWallet.cancelStageAirGapScan({
            scanning: true,
            sessionId: scanSessionId,
          });
        }
        return {};
      }
      if (submittedRef.current || unmountedRef.current) {
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
      return submitResult({ result: outcome.result, sessionId: scanSessionId });
    },
    [submitResult],
  );
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
