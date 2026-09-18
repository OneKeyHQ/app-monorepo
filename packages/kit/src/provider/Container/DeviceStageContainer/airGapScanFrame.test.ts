import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import {
  createScannedFrameGate,
  interpretAirGapScanFrame,
} from './airGapScanFrame';

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

describe('createScannedFrameGate', () => {
  it('admits a frame once and filters its repeats', () => {
    const gate = createScannedFrameGate();
    expect(gate.admit('ur:bytes/static')).toBe(true);
    expect(gate.admit('ur:bytes/static')).toBe(false);
    expect(gate.admit('ur:bytes/other')).toBe(true);
    expect(gate.admit('')).toBe(false);
    expect(gate.admit(undefined)).toBe(false);
  });

  it('lets the same frame through again once the handler asks for a retry', () => {
    // A static code is one frame, always the same bytes: after a rejected
    // submit the handler's own gate had reopened, but the host still
    // filtered every repeat, so the pending call waited for expiry.
    const gate = createScannedFrameGate();
    expect(gate.admit('ur:bytes/static')).toBe(true);
    expect(gate.admit('ur:bytes/static')).toBe(false);
    gate.release('ur:bytes/static');
    expect(gate.admit('ur:bytes/static')).toBe(true);
  });

  it('ignores a release for a frame that is not the remembered one', () => {
    const gate = createScannedFrameGate();
    gate.admit('ur:bytes/current');
    gate.release('ur:bytes/stale');
    expect(gate.admit('ur:bytes/current')).toBe(false);
  });

  it('forgets everything on reset and reports whether anything was admitted', () => {
    const gate = createScannedFrameGate();
    expect(gate.hasAdmittedAny()).toBe(false);
    gate.admit('ur:bytes/static');
    expect(gate.hasAdmittedAny()).toBe(true);
    gate.reset();
    expect(gate.hasAdmittedAny()).toBe(false);
    expect(gate.admit('ur:bytes/static')).toBe(true);
  });
});
