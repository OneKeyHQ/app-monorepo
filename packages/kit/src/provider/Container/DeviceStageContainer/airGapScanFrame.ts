import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

/**
 * What one camera frame means to the air-gap scan (OK-59934 §4.6) — the
 * legacy scan page's per-frame decision, extracted pure so the stage's
 * embedded viewfinder replays it exactly.
 *
 * A UR frame still collecting reports progress; the frame that completes
 * the set promotes `fullData` to `raw` (the shape
 * `startTwoWayAirGapScanUr` reads first). Anything that is not an
 * animation code — the verify-address flow's plain-text answer above
 * all — is complete the moment it is read, `raw` already carrying it.
 */
export type IAirGapScanFrameOutcome =
  | { kind: 'progress'; progress?: number }
  | { kind: 'complete'; result: IQRCodeHandlerParseResult<IAnimationValue> };

export function interpretAirGapScanFrame(
  parsed: IQRCodeHandlerParseResult<IBaseValue>,
): IAirGapScanFrameOutcome {
  if (parsed.type === EQRCodeHandlerType.ANIMATION_CODE) {
    const animationValue = parsed.data as IAnimationValue;
    if (animationValue.fullData) {
      return {
        kind: 'complete',
        result: {
          ...parsed,
          raw: animationValue.fullData,
        } as IQRCodeHandlerParseResult<IAnimationValue>,
      };
    }
    return { kind: 'progress', progress: animationValue.progress };
  }
  return {
    kind: 'complete',
    result: parsed as IQRCodeHandlerParseResult<IAnimationValue>,
  };
}

/**
 * The host's same-frame filter, as one small state machine so it can be
 * tested. A camera delivers the frame it is looking at many times a second;
 * the host handles each distinct frame once. But "once" must be revocable:
 * when the handler reports a `retry` (its submit rejected), the frame is
 * forgotten so the next delivery of the same bytes reaches the handler again
 * — a static code is one frame, always the same bytes, and would otherwise
 * never get a second chance.
 */
export function createScannedFrameGate() {
  let last: string | undefined;
  return {
    /** Whether this delivery should reach the handler; remembers it if so. */
    admit(frame: string | null | undefined): boolean {
      if (!frame || frame === last) {
        return false;
      }
      last = frame;
      return true;
    },
    /** The handler asked for another go at the frame it was just given. */
    release(frame: string) {
      if (last === frame) {
        last = undefined;
      }
    },
    /** A fresh visit: nothing is remembered. */
    reset() {
      last = undefined;
    },
    hasAdmittedAny(): boolean {
      return last !== undefined;
    },
  };
}

export type IScannedFrameGate = ReturnType<typeof createScannedFrameGate>;
