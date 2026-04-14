import { AppError, ERROR_CODES } from '../../errors';

import {
  getActiveTransferPairingRuntime,
  getTransferPairingRuntimeError,
  replaceActiveTransferPairingRuntime,
  startTransferPairingRuntimeTimeout,
} from './pairing-session-runtime';
import { renderAsciiQr } from './qr-renderer';

import type {
  ITransferPairingRuntime,
  ITransferStateSnapshot,
} from './transfer-types';
import type { AppTransferLoginResult } from '../auth/auth-types';

const SPINNER_FRAMES = ['|', '/', '-', '\\'];

interface IRuntimeTextWriter {
  isTTY?: boolean;
  write(chunk: string | Uint8Array): boolean;
}

interface IRunAppTransferPairingDisplayOptions {
  runtime?: ITransferPairingRuntime;
  stderr?: IRuntimeTextWriter;
  renderQr?: (uri: string) => string;
  refreshIntervalMs?: number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  now?: () => Date;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

function buildPairingDisplayScreen(
  pairingSession: AppTransferLoginResult,
  qrText: string,
): string {
  return [
    'Scan the QR code in OneKey App or enter the pairing code manually.',
    '',
    qrText,
    '',
    `Pairing code: ${pairingSession.pairingCode}`,
    'In OneKey App, open Bot Wallet import and scan the QR code or enter the pairing code.',
    '',
  ].join('\n');
}

function buildVerificationCodeScreen(verificationCode: string): string {
  return [
    'Verification code:',
    verificationCode,
    'Enter this code in OneKey App to confirm the export.',
    '',
  ].join('\n');
}

function resolvePairingRuntime(
  pairingSession: AppTransferLoginResult,
  runtime?: ITransferPairingRuntime,
): ITransferPairingRuntime {
  const activeRuntime = runtime ?? getActiveTransferPairingRuntime();

  if (
    !activeRuntime ||
    activeRuntime.pairingCode !== pairingSession.pairingCode
  ) {
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      'App Transfer pairing session is unavailable',
      'Retry the App Transfer login flow',
    );
  }

  return activeRuntime;
}

function createTerminalStateError(
  runtime: ITransferPairingRuntime,
  state: ITransferStateSnapshot,
): AppError | null {
  if (state.status === 'completed') {
    return null;
  }

  if (state.status === 'cancelled') {
    return new AppError(
      ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
      state.message,
      'Retry the App Transfer login flow',
    );
  }

  if (state.status === 'timeout') {
    return new AppError(
      ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code,
      state.message,
      'Retry the App Transfer login flow',
    );
  }

  return (
    getTransferPairingRuntimeError(runtime) ??
    new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      state.message,
      'Retry the App Transfer login flow',
    )
  );
}

export async function runAppTransferPairingDisplay(
  pairingSession: AppTransferLoginResult,
  {
    runtime,
    stderr = process.stderr,
    renderQr = renderAsciiQr,
    refreshIntervalMs = 80,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    now = () => new Date(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  }: IRunAppTransferPairingDisplayOptions = {},
): Promise<void> {
  const pairingRuntime = resolvePairingRuntime(pairingSession, runtime);
  const qrText = renderQr(pairingSession.pairingPayload.uri);
  let terminalState: ITransferStateSnapshot | undefined;
  let terminalError: AppError | null = null;
  let renderedVerificationCode: string | null = null;

  stderr.write(`${buildPairingDisplayScreen(pairingSession, qrText)}\n`);
  const timeoutWindow = startTransferPairingRuntimeTimeout(pairingRuntime, {
    timeoutMs: pairingSession.timeoutMs,
    now,
    setTimeoutFn,
    clearTimeoutFn,
  });
  if (timeoutWindow) {
    pairingSession.expiresAt = timeoutWindow.expiresAt;
  }

  let frameIndex = 0;
  let lastLineLength = 0;
  let isStopped = false;

  const renderVerificationCodeIfAvailable = () => {
    const verificationCode = pairingRuntime.getVerificationCode();
    if (!verificationCode || verificationCode === renderedVerificationCode) {
      return;
    }

    if (lastLineLength > 0) {
      stderr.write(`\r${''.padEnd(lastLineLength, ' ')}\r`);
      lastLineLength = 0;
    }

    stderr.write(`${buildVerificationCodeScreen(verificationCode)}\n`);
    renderedVerificationCode = verificationCode;
  };

  const renderStatusLine = () => {
    renderVerificationCodeIfAvailable();

    const state = pairingRuntime.getState();
    const frame = state.isTerminal
      ? ' '
      : SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    frameIndex += 1;

    const line = `${frame} ${state.message}`;
    lastLineLength = Math.max(lastLineLength, line.length);
    stderr.write(`\r${line.padEnd(lastLineLength, ' ')}`);

    if (state.isTerminal) {
      stderr.write('\n');
    }
  };

  let unsubscribe: () => void = () => {};
  const intervalRef: { current?: ReturnType<typeof setInterval> } = {};
  const stop = () => {
    if (isStopped) {
      return;
    }

    isStopped = true;
    unsubscribe();

    if (intervalRef.current) {
      clearIntervalFn(intervalRef.current);
    }
  };

  unsubscribe = pairingRuntime.subscribe(() => {
    renderStatusLine();
  });

  intervalRef.current = setIntervalFn(() => {
    if (!pairingRuntime.getState().isTerminal) {
      renderStatusLine();
    }
  }, refreshIntervalMs);

  try {
    terminalState = await pairingRuntime.waitForState(
      (state) => state.isTerminal,
    );
    if (terminalState) {
      terminalError = createTerminalStateError(pairingRuntime, terminalState);
    }
  } finally {
    stop();

    if (!pairingRuntime.getState().isTerminal && lastLineLength > 0) {
      stderr.write(`\r${''.padEnd(lastLineLength, ' ')}\r`);
    }

    if (pairingRuntime.getState().isTerminal) {
      if (getActiveTransferPairingRuntime() === pairingRuntime) {
        await replaceActiveTransferPairingRuntime(null);
      } else {
        await pairingRuntime.dispose();
      }
    }
  }

  if (terminalError) {
    throw AppError.from(terminalError);
  }
}
