import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import {
  getCameraFlowUnmountResult,
  getCameraScanFlowResult,
  getLibraryScanFlowResult,
  getQrScanFlowErrorResult,
  getScanQrCodeAvailabilityScene,
  isCameraScanExpectingMoreFrames,
} from './scanQrCodeAvailability';

import type { IScanQrCodeCallbackResult } from './scanQrCodeAvailability';

function resolvedScan(
  overrides: Partial<Parameters<typeof getCameraScanFlowResult>[0]> = {},
) {
  return getCameraScanFlowResult({
    value: 'ur:crypto-psbt/1-3/abc',
    result: {},
    isFlowCurrent: true,
    pendingScans: 0,
    ...overrides,
  });
}

describe('scanQrCodeAvailability', () => {
  describe('getScanQrCodeAvailabilityScene', () => {
    it('separates the QR wallet scene from general scans', () => {
      expect(getScanQrCodeAvailabilityScene(true)).toBe('qr_wallet');
      expect(getScanQrCodeAvailabilityScene(false)).toBe('general');
      expect(getScanQrCodeAvailabilityScene(undefined)).toBe('general');
    });
  });

  describe('getQrScanFlowErrorResult', () => {
    it('counts user cancellations as cancelled', () => {
      expect(
        getQrScanFlowErrorResult({
          className: EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
        }),
      ).toEqual({
        status: 'cancelled',
        errorCode: 'onekeyerrorscanqrcodecancel',
      });
      expect(
        getQrScanFlowErrorResult({
          className: EOneKeyErrorClassNames.PasswordPromptDialogCancel,
        }),
      ).toEqual({
        status: 'cancelled',
        errorCode: 'passwordpromptdialogcancel',
      });
      expect(getQrScanFlowErrorResult({ code: 'ERR_CANCELED' })).toEqual({
        status: 'cancelled',
        errorCode: 'err_canceled',
      });
      expect(getQrScanFlowErrorResult({ name: 'AbortError' })).toEqual({
        status: 'cancelled',
        errorCode: 'aborterror',
      });
      expect(
        getQrScanFlowErrorResult({ code: HardwareErrorCode.ActionCancelled }),
      ).toEqual({
        status: 'cancelled',
        errorCode: String(HardwareErrorCode.ActionCancelled),
      });
    });

    it('counts every other error as failed, never timeout', () => {
      expect(getQrScanFlowErrorResult(new Error('boom'))).toEqual({
        status: 'failed',
        errorCode: 'error',
      });
      expect(getQrScanFlowErrorResult({ code: 'ETIMEDOUT' })).toEqual({
        status: 'failed',
        errorCode: 'etimedout',
      });
      expect(getQrScanFlowErrorResult({ message: 'request timeout' })).toEqual({
        status: 'failed',
        errorCode: 'unknown',
      });
    });

    it('counts non-object throws as failed with an unknown code', () => {
      expect(getQrScanFlowErrorResult('boom')).toEqual({
        status: 'failed',
        errorCode: 'unknown',
      });
      expect(getQrScanFlowErrorResult(undefined)).toEqual({
        status: 'failed',
        errorCode: 'unknown',
      });
      expect(getQrScanFlowErrorResult(null)).toEqual({
        status: 'failed',
        errorCode: 'unknown',
      });
    });

    it('keeps error text out of the error code and does not mutate', () => {
      const error = {
        code: 'invalid address 0xabc: secret',
        name: 'CanceledError',
      };
      expect(getQrScanFlowErrorResult(error)).toEqual({
        status: 'cancelled',
        errorCode: 'unknown',
      });
      expect(error).toEqual({
        code: 'invalid address 0xabc: secret',
        name: 'CanceledError',
      });
    });
  });

  describe('isCameraScanExpectingMoreFrames', () => {
    it.each<[string, IScanQrCodeCallbackResult | undefined, boolean]>([
      ['no callback result', undefined, false],
      ['empty callback result', {}, false],
      ['completed animated code', { progress: 1 }, false],
      ['progress above one', { progress: 1.5 }, false],
      ['non-numeric progress', { progress: Number.NaN }, false],
      ['explicit retry false', { retry: false }, false],
      ['first animated frame', { progress: 0 }, true],
      ['partial animated code', { progress: 0.4 }, true],
      ['rejected frame', { retry: true }, true],
      ['rejected frame with full progress', { retry: true, progress: 1 }, true],
    ])('%s', (_label, result, expected) => {
      expect(isCameraScanExpectingMoreFrames(result)).toBe(expected);
    });
  });

  describe('getCameraScanFlowResult', () => {
    it('counts an empty value as cancelled whatever the callback returned', () => {
      expect(resolvedScan({ value: '' })).toEqual({ status: 'cancelled' });
      expect(resolvedScan({ value: '', result: { progress: 0.5 } })).toEqual({
        status: 'cancelled',
      });
      expect(resolvedScan({ value: '', result: { retry: true } })).toEqual({
        status: 'cancelled',
      });
      expect(
        resolvedScan({ value: '', isFlowCurrent: false, pendingScans: 2 }),
      ).toEqual({ status: 'cancelled' });
    });

    it('counts a completed scan as ok', () => {
      expect(resolvedScan({ result: {} })).toEqual({ status: 'ok' });
      expect(resolvedScan({ result: undefined })).toEqual({ status: 'ok' });
      expect(resolvedScan({ result: { progress: 1 } })).toEqual({
        status: 'ok',
      });
    });

    it('counts a completed scan as ok even after the callback closed the modal', () => {
      expect(
        resolvedScan({
          result: { progress: 1 },
          isFlowCurrent: false,
          pendingScans: 0,
        }),
      ).toEqual({ status: 'ok' });
      expect(
        resolvedScan({ result: {}, isFlowCurrent: false, pendingScans: 1 }),
      ).toEqual({ status: 'ok' });
    });

    it('keeps the flow open for partial animated codes and rejected frames', () => {
      expect(resolvedScan({ result: { progress: 0.25 } })).toBeUndefined();
      expect(resolvedScan({ result: { progress: 0 } })).toBeUndefined();
      expect(resolvedScan({ result: { retry: true } })).toBeUndefined();
      expect(
        resolvedScan({ result: { retry: true }, pendingScans: 1 }),
      ).toBeUndefined();
    });

    it('counts cancelled when the modal closed while waiting for more frames', () => {
      expect(
        resolvedScan({
          result: { progress: 0.5 },
          isFlowCurrent: false,
          pendingScans: 0,
        }),
      ).toEqual({ status: 'cancelled' });
      expect(
        resolvedScan({
          result: { retry: true },
          isFlowCurrent: false,
          pendingScans: 0,
        }),
      ).toEqual({ status: 'cancelled' });
    });

    it('leaves the outcome to the last pending scan after the modal closed', () => {
      expect(
        resolvedScan({
          result: { progress: 0.5 },
          isFlowCurrent: false,
          pendingScans: 1,
        }),
      ).toBeUndefined();
    });
  });

  describe('getCameraFlowUnmountResult', () => {
    it('counts cancelled when no scan is awaiting the route callback', () => {
      expect(getCameraFlowUnmountResult({ pendingScans: 0 })).toEqual({
        status: 'cancelled',
      });
    });

    it('leaves the outcome to pending scans', () => {
      expect(getCameraFlowUnmountResult({ pendingScans: 1 })).toBeUndefined();
      expect(getCameraFlowUnmountResult({ pendingScans: 3 })).toBeUndefined();
    });
  });

  describe('getLibraryScanFlowResult', () => {
    it('counts a dismissed picker as cancelled', () => {
      expect(getLibraryScanFlowResult({ type: 'pickerCancelled' })).toEqual({
        status: 'cancelled',
      });
    });

    it('counts a decoded code accepted by the callback as ok', () => {
      expect(getLibraryScanFlowResult({ type: 'callbackResolved' })).toEqual({
        status: 'ok',
      });
    });

    it('counts an image without a code as no_code', () => {
      expect(getLibraryScanFlowResult({ type: 'noCode' })).toEqual({
        status: 'no_code',
      });
      expect(
        getLibraryScanFlowResult({ type: 'noCode', scanError: undefined }),
      ).toEqual({ status: 'no_code' });
      expect(
        getLibraryScanFlowResult({ type: 'noCode', scanError: null }),
      ).toEqual({ status: 'no_code' });
    });

    it('counts a decoder error as failed with its code', () => {
      expect(
        getLibraryScanFlowResult({
          type: 'noCode',
          scanError: new TypeError('decode'),
        }),
      ).toEqual({ status: 'failed', errorCode: 'typeerror' });
      expect(
        getLibraryScanFlowResult({ type: 'noCode', scanError: 'boom' }),
      ).toEqual({ status: 'failed', errorCode: 'unknown' });
    });

    it('never counts a decoder error as cancelled', () => {
      expect(
        getLibraryScanFlowResult({
          type: 'noCode',
          scanError: { code: 'ERR_CANCELED' },
        }),
      ).toEqual({ status: 'failed', errorCode: 'err_canceled' });
    });
  });
});
