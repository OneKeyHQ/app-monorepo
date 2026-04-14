import {
  EPrimeTransferDataType,
  EPrimeTransferServerType,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { runAppTransferPairingDisplay } from '../core/prime-transfer/pairing-display-runtime';
import {
  createTransferPairingRuntime,
  getActiveTransferPairingRuntime,
  replaceActiveTransferPairingRuntime,
  setTransferPairingRuntimeError,
} from '../core/prime-transfer/pairing-session-runtime';
import { AppError, ERROR_CODES } from '../errors';

import type { AppTransferLoginResult } from '../core/auth/auth-types';

function makePairingResult(): AppTransferLoginResult {
  return {
    status: 'pairing',
    loginMethod: 'app_transfer',
    pairingCode: 'ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
    createdAt: '2026-04-06T07:00:00.000Z',
    timeoutMs: 120_000,
    expiresAt: '2026-04-06T07:02:00.000Z',
    pairingPayload: {
      roomId: 'ABCDEFGH123',
      transferType: EPrimeTransferDataType.keylessWallet,
      serverType: EPrimeTransferServerType.OFFICIAL,
      websocketEndpoint: 'wss://transfer.onekeytest.com',
      uri: 'onekey-wallet://cross-device-transfer/?code=ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
      verifyString: 'OneKeyPrimeTransfer',
    },
  };
}

describe('runAppTransferPairingDisplay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await replaceActiveTransferPairingRuntime(null);
    jest.useRealTimers();
  });

  it('writes QR, pairing code, and waiting updates to stderr without leaking secrets', async () => {
    const pairingResult = makePairingResult();
    let stderrOutput = '';
    const runtime = createTransferPairingRuntime({
      roomId: pairingResult.pairingPayload.roomId,
      userId: 'user-1',
      pairingCode: pairingResult.pairingCode,
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      dispose: async () => undefined,
    });

    const displayPromise = runAppTransferPairingDisplay(pairingResult, {
      runtime,
      stderr: {
        isTTY: true,
        write: (chunk: string | Uint8Array) => {
          stderrOutput += String(chunk);
          return true;
        },
      },
      renderQr: () => '██\n██',
      refreshIntervalMs: 80,
    });

    jest.advanceTimersByTime(160);
    runtime.transition('pairing_verified');
    runtime.transition('transfer_receiving');
    runtime.transition('transfer_completed');

    await displayPromise;

    expect(stderrOutput).toContain('Scan the QR code');
    expect(stderrOutput).toContain(pairingResult.pairingCode);
    expect(stderrOutput).toContain('██');
    expect(stderrOutput).toContain('Waiting for OneKey App');
    expect(stderrOutput).toContain('Receiving the encrypted wallet payload');
    expect(stderrOutput).not.toContain(pairingResult.pairingPayload.uri);
    expect(stderrOutput).not.toContain(
      pairingResult.pairingPayload.verifyString,
    );
    expect(stderrOutput).not.toContain('shared secret');
    expect(stderrOutput).not.toContain('encrypted key');
    expect(stderrOutput).not.toContain('mnemonic');
  });

  it('prints the verification code when OneKey App requests export confirmation', async () => {
    const pairingResult = makePairingResult();
    let stderrOutput = '';
    const runtime = createTransferPairingRuntime({
      roomId: pairingResult.pairingPayload.roomId,
      userId: 'user--338713',
      pairingCode: pairingResult.pairingCode,
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      dispose: async () => undefined,
    });

    const displayPromise = runAppTransferPairingDisplay(pairingResult, {
      runtime,
      stderr: {
        isTTY: true,
        write: (chunk: string | Uint8Array) => {
          stderrOutput += String(chunk);
          return true;
        },
      },
      renderQr: () => '██\n██',
      refreshIntervalMs: 80,
    });

    runtime.transition('pairing_verified');
    runtime.setVerificationCode('804836');
    jest.advanceTimersByTime(160);
    runtime.transition('transfer_completed');

    await displayPromise;

    expect(stderrOutput).toContain('Verification code:');
    expect(stderrOutput).toContain('804836');
    expect(stderrOutput).toContain(
      'Enter this code in OneKey App to confirm the export.',
    );
  });

  it('rejects failed terminal states and clears the active runtime', async () => {
    const pairingResult = makePairingResult();
    const dispose = jest.fn(async () => undefined);
    const runtime = createTransferPairingRuntime({
      roomId: pairingResult.pairingPayload.roomId,
      userId: 'user-1',
      pairingCode: pairingResult.pairingCode,
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      dispose,
    });

    await replaceActiveTransferPairingRuntime(runtime);

    const displayPromise = runAppTransferPairingDisplay(pairingResult, {
      runtime,
      stderr: {
        write: () => true,
      },
      renderQr: () => '██\n██',
      refreshIntervalMs: 80,
    });

    runtime.transition('transfer_failed');

    await expect(displayPromise).rejects.toMatchObject({
      code: 'NET_REQUEST_FAILED',
      message: 'Transfer failed.',
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(getActiveTransferPairingRuntime()).toBeNull();
  });

  it('replays the stored runtime error for failed terminal states', async () => {
    const pairingResult = makePairingResult();
    const runtime = createTransferPairingRuntime({
      roomId: pairingResult.pairingPayload.roomId,
      userId: 'user-1',
      pairingCode: pairingResult.pairingCode,
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      dispose: async () => undefined,
    });

    setTransferPairingRuntimeError(
      runtime,
      new AppError(
        ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
        'App Transfer payload is invalid.',
        'Retry the App Transfer login flow from OneKey App',
      ),
    );

    const displayPromise = runAppTransferPairingDisplay(pairingResult, {
      runtime,
      stderr: {
        write: () => true,
      },
      renderQr: () => '██\n██',
      refreshIntervalMs: 80,
    });

    runtime.transition('transfer_failed');

    await expect(displayPromise).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
      message: 'App Transfer payload is invalid.',
    });
  });

  it('starts the pairing timeout when instructions are first rendered', async () => {
    const pairingResult = {
      ...makePairingResult(),
      timeoutMs: 1200,
    };
    const dispose = jest.fn(async () => undefined);
    const runtime = createTransferPairingRuntime({
      roomId: pairingResult.pairingPayload.roomId,
      userId: 'user-1',
      pairingCode: pairingResult.pairingCode,
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      dispose,
    });

    await replaceActiveTransferPairingRuntime(runtime);

    const displayPromise = runAppTransferPairingDisplay(pairingResult, {
      runtime,
      stderr: {
        write: () => true,
      },
      renderQr: () => '██\n██',
      refreshIntervalMs: 80,
    });

    jest.advanceTimersByTime(1199);
    expect(runtime.getState().status).toBe('pairing');

    jest.advanceTimersByTime(1);

    await expect(displayPromise).rejects.toMatchObject({
      code: 'AUTH_TRANSFER_TIMEOUT',
      message: 'Transfer timed out.',
    });
    expect(runtime.getState()).toMatchObject({
      event: 'transfer_timeout',
      status: 'timeout',
      isTerminal: true,
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(getActiveTransferPairingRuntime()).toBeNull();
  });
});
