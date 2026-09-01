import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { interpretAirGapScanFrame } from './airGapScanFrame';

describe('interpretAirGapScanFrame', () => {
  it('reports progress while a multi-part UR is still collecting', () => {
    const parsed = {
      type: EQRCodeHandlerType.ANIMATION_CODE,
      raw: 'UR:ETH-SIGNATURE/1-3/SOMEPART',
      data: {
        partSize: 3,
        partIndexes: [0],
        progress: 0.33,
        parts: [],
      } as IAnimationValue,
    } as IQRCodeHandlerParseResult<IBaseValue>;
    expect(interpretAirGapScanFrame(parsed)).toEqual({
      kind: 'progress',
      progress: 0.33,
    });
  });

  it('completes on the frame that closes the set, raw promoted to fullData', () => {
    // `startTwoWayAirGapScanUr` reads data.fullData || raw — the legacy
    // scan page promoted fullData into raw on resolve, and so does this.
    const parsed = {
      type: EQRCodeHandlerType.ANIMATION_CODE,
      raw: 'UR:ETH-SIGNATURE/3-3/LASTPART',
      data: {
        partSize: 3,
        partIndexes: [0, 1, 2],
        progress: 1,
        parts: [],
        fullData: 'UR:ETH-SIGNATURE/FULL',
      } as IAnimationValue,
    } as IQRCodeHandlerParseResult<IBaseValue>;
    const outcome = interpretAirGapScanFrame(parsed);
    expect(outcome.kind).toBe('complete');
    if (outcome.kind === 'complete') {
      expect(outcome.result.raw).toBe('UR:ETH-SIGNATURE/FULL');
      expect(outcome.result.data.fullData).toBe('UR:ETH-SIGNATURE/FULL');
    }
  });

  it('completes a plain-text answer on first read, raw untouched', () => {
    // The verify-address flow: the device shows the address itself, not a
    // UR — the animation handler declines it and the fallback carries it
    // whole in raw.
    const parsed = {
      type: EQRCodeHandlerType.UNKNOWN,
      raw: 'bc1qexampleaddress',
      data: 'bc1qexampleaddress' as unknown as IBaseValue,
    } as IQRCodeHandlerParseResult<IBaseValue>;
    const outcome = interpretAirGapScanFrame(parsed);
    expect(outcome.kind).toBe('complete');
    if (outcome.kind === 'complete') {
      expect(outcome.result.raw).toBe('bc1qexampleaddress');
    }
  });
});
