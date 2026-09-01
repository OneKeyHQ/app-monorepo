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
