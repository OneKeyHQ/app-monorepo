import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { HardwareLiteCardScene } from './litecard';

import type { ILiteCardDiagnostic } from './litecard';

const operationId = 'a7e0eea1-8035-428a-9df3-e3c915da2db1';

describe('Lite card local diagnostics privacy', () => {
  it('projects legacy card and error objects without identifiers or messages', () => {
    const scene = new HardwareLiteCardScene();
    const emitLog = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
    const privateValue = 'excluded-sensitive-fixture';
    const cardInfo = {
      hasBackup: true,
      isNewCard: false,
      serialNum: privateValue,
      pinRetryCount: 9,
      mnemonic: privateValue,
      data: privateValue,
    };
    const error = { code: 2001, message: privateValue, stack: privateValue };
    scene.log('getMnemonicWithPin result', { cardInfo, error });
    expect(emitLog).toHaveBeenCalledWith(
      'log',
      [
        {
          message: 'getMnemonicWithPin result',
          hasCardInfo: true,
          hasBackup: true,
          isNewCard: false,
          errorCode: 2001,
        },
      ],
      [expect.objectContaining({ type: 'local', level: 'info' })],
    );
    expect(JSON.stringify(emitLog.mock.calls)).not.toContain(privateValue);
    expect(JSON.stringify(emitLog.mock.calls)).not.toContain('pinRetryCount');
    scene.log(privateValue, {
      error: { code: 999_999, message: privateValue },
    });
    expect(emitLog.mock.calls[1][1]).toEqual([
      {
        message: 'lite-card',
        hasCardInfo: false,
        hasBackup: undefined,
        isNewCard: undefined,
        errorCode: undefined,
      },
    ]);
  });

  it('keeps only finite timing, temporary UUIDs, known enums and boolean state', () => {
    const scene = new HardwareLiteCardScene();
    const emitLog = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
    const privateValue = 'excluded-sensitive-fixture';
    const event = Object.freeze({
      operation: 'import',
      phase: 'native-result',
      operationId,
      elapsedMs: 42,
      attempt: 2,
      nativeMethod: 'getMnemonicWithPin',
      errorCode: 2001,
      eventCode: 2,
      hasCardInfo: true,
      hasBackup: false,
      isNewCard: true,
      overwrite: false,
      hasDialogRef: true,
      isSetNewPassword: false,
      isConfirm: false,
      isSuccess: false,
      closeReason: 'cancel',
      eventTimeMs: privateValue,
      pin: privateValue,
      mnemonic: privateValue,
      encodedMnemonic: privateValue,
      serialNum: privateValue,
      walletId: privateValue,
      data: privateValue,
      error: { message: privateValue, stack: privateValue },
    });
    const before = Date.now();
    scene.diagnostic(event as ILiteCardDiagnostic);
    const payload = emitLog.mock.calls[0][1][0] as Record<string, unknown>;
    expect(payload).toEqual({
      operation: 'import',
      phase: 'native-result',
      operationId,
      eventTimeMs: expect.any(Number),
      elapsedMs: 42,
      attempt: 2,
      nativeMethod: 'getMnemonicWithPin',
      errorCode: 2001,
      eventCode: 2,
      hasCardInfo: true,
      hasBackup: false,
      isNewCard: true,
      overwrite: false,
      hasDialogRef: true,
      isSetNewPassword: false,
      isConfirm: false,
      isSuccess: false,
      closeReason: 'cancel',
    });
    expect(payload.eventTimeMs).toBeGreaterThanOrEqual(before);
    expect(payload.eventTimeMs).toBeLessThanOrEqual(Date.now());
    expect(emitLog.mock.calls[0][2]).toEqual([
      expect.objectContaining({ type: 'local', level: 'info' }),
    ]);
    expect(JSON.stringify(emitLog.mock.calls)).not.toContain(privateValue);

    scene.diagnostic({
      operation: 'nfc',
      phase: 'connection-event',
      operationId: privateValue,
      elapsedMs: Infinity,
      attempt: NaN,
      nativeMethod: privateValue,
      errorCode: 999_999,
      eventCode: 999_999,
      hasBackup: privateValue,
      closeReason: privateValue,
    } as unknown as ILiteCardDiagnostic);
    const malformed = emitLog.mock.calls[1][1][0] as Record<string, unknown>;
    expect(malformed.operationId).toBeUndefined();
    expect(malformed.elapsedMs).toBeUndefined();
    expect(malformed.attempt).toBeUndefined();
    expect(malformed.nativeMethod).toBeUndefined();
    expect(malformed.errorCode).toBeUndefined();
    expect(malformed.eventCode).toBeUndefined();
    expect(malformed.hasBackup).toBeUndefined();
    expect(malformed.closeReason).toBeUndefined();
    expect(JSON.stringify(emitLog.mock.calls)).not.toContain(privateValue);

    scene.diagnostic({
      operation: 'nfc',
      phase: privateValue,
      operationId,
    } as unknown as ILiteCardDiagnostic);
    expect(emitLog).toHaveBeenCalledTimes(2);
  });

  it('does not propagate a local logging sink failure into card operations', () => {
    const scene = new HardwareLiteCardScene();
    jest.spyOn(scene, '_emitLog').mockImplementation(() => {
      throw new OneKeyLocalError('logging sink unavailable');
    });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      expect(() =>
        scene.diagnostic({
          operation: 'pin',
          phase: 'pin-confirm-resolve',
          operationId,
        }),
      ).not.toThrow();
      expect(() => scene.log('reset card result', {})).not.toThrow();
    } finally {
      consoleError.mockRestore();
    }
  });
});
