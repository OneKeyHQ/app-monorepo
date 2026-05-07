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

const ESC = String.fromCharCode(27);
const ANSI_CLEAR_PATTERN = new RegExp(`${ESC}\\[\\d+A${ESC}\\[0J`);

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

  it('writes QR, server, and pairing code to stderr without leaking secrets and without a loading spinner', async () => {
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
    });

    jest.advanceTimersByTime(160);
    runtime.transition('pairing_verified');
    runtime.transition('transfer_receiving');
    runtime.transition('transfer_completed');

    await displayPromise;

    expect(stderrOutput).toContain('Scan the QR code');
    expect(stderrOutput).toContain(
      'Pairing Server: https://transfer.onekeytest.com',
    );
    expect(stderrOutput).toContain(
      `Pairing code:\n${pairingResult.pairingCode}`,
    );
    expect(stderrOutput).toContain('██');
    expect(stderrOutput).toContain(
      'Waiting for OneKey App to scan the QR code or enter the pairing code...',
    );
    expect(stderrOutput).toContain(
      'Receiving the encrypted wallet payload from OneKey App...',
    );
    expect(stderrOutput).not.toContain('\r');
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

  it('clears the verification code from the terminal once the user confirms in App', async () => {
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
    });

    runtime.transition('pairing_verified');
    runtime.setVerificationCode('032653');

    const beforeReceive = stderrOutput;
    expect(beforeReceive).toContain('Verification code:');
    expect(beforeReceive).toContain('032653');

    runtime.transition('transfer_receiving');

    const afterReceive = stderrOutput.slice(beforeReceive.length);
    expect(afterReceive).toMatch(ANSI_CLEAR_PATTERN);
    expect(afterReceive.indexOf('\x1b[')).toBeLessThan(
      afterReceive.indexOf('Receiving the encrypted wallet payload'),
    );

    runtime.transition('transfer_completed');
    await displayPromise;
  });

  it('clears the QR and pairing code from the terminal once the App connects', async () => {
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
    });

    const beforeConnect = stderrOutput;
    expect(beforeConnect).not.toMatch(ANSI_CLEAR_PATTERN);

    runtime.transition('pairing_verified');

    const afterConnect = stderrOutput.slice(beforeConnect.length);
    expect(afterConnect).toMatch(ANSI_CLEAR_PATTERN);
    expect(afterConnect.indexOf('\x1b[')).toBeLessThan(
      afterConnect.indexOf('OneKey App connected'),
    );

    runtime.transition('transfer_completed');
    await displayPromise;
  });

  it('does not emit ANSI clear sequences when stderr is not a TTY', async () => {
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
        isTTY: false,
        write: (chunk: string | Uint8Array) => {
          stderrOutput += String(chunk);
          return true;
        },
      },
      renderQr: () => '██\n██',
    });

    runtime.transition('pairing_verified');
    runtime.transition('transfer_completed');
    await displayPromise;

    expect(stderrOutput).not.toContain('\x1b[');
    expect(stderrOutput).toContain(pairingResult.pairingCode);
    expect(stderrOutput).toContain('OneKey App connected');
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
