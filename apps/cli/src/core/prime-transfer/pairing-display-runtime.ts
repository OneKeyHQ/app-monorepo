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

interface IRuntimeTextWriter {
  isTTY?: boolean;
  write(chunk: string | Uint8Array): boolean;
}

interface IRunAppTransferPairingDisplayOptions {
  runtime?: ITransferPairingRuntime;
  stderr?: IRuntimeTextWriter;
  renderQr?: (uri: string) => string;
  now?: () => Date;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

function toHttpEndpointForDisplay(websocketEndpoint: string): string {
  return websocketEndpoint
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:');
}

function buildPairingDisplayScreen(
  pairingSession: AppTransferLoginResult,
  qrText: string,
): string {
  const serverUrl = toHttpEndpointForDisplay(
    pairingSession.pairingPayload.websocketEndpoint,
  );
  return [
    'Scan the QR code in OneKey App or enter the pairing code manually.',
    '',
    qrText,
    '',
    `Pairing Server: ${serverUrl}`,
    'Pairing code:',
    pairingSession.pairingCode,
    '',
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
  let lastRenderedStatusMessage: string | null = null;
  let pairingPhaseLineCount = 0;
  let pairingPhaseCleared = false;
  let verificationPhaseLineCount = 0;
  let verificationPhaseCleared = false;
  let verificationPhaseActive = false;

  const countNewlines = (text: string): number => {
    let count = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === '\n') {
        count += 1;
      }
    }
    return count;
  };

  const writeStderr = (text: string): void => {
    stderr.write(text);
    const newlines = countNewlines(text);
    if (!pairingPhaseCleared) {
      pairingPhaseLineCount += newlines;
    } else if (verificationPhaseActive && !verificationPhaseCleared) {
      verificationPhaseLineCount += newlines;
    }
  };

  const clearPairingPhaseIfNeeded = (): void => {
    if (pairingPhaseCleared) {
      return;
    }
    pairingPhaseCleared = true;
    if (!stderr.isTTY) {
      return;
    }
    if (pairingPhaseLineCount > 0) {
      stderr.write(`\x1b[${pairingPhaseLineCount}A\x1b[0J`);
    }
  };

  const clearVerificationPhaseIfNeeded = (): void => {
    if (!verificationPhaseActive || verificationPhaseCleared) {
      return;
    }
    verificationPhaseCleared = true;
    if (!stderr.isTTY) {
      return;
    }
    if (verificationPhaseLineCount > 0) {
      stderr.write(`\x1b[${verificationPhaseLineCount}A\x1b[0J`);
    }
  };

  writeStderr(`${buildPairingDisplayScreen(pairingSession, qrText)}\n`);
  const timeoutWindow = startTransferPairingRuntimeTimeout(pairingRuntime, {
    timeoutMs: pairingSession.timeoutMs,
    now,
    setTimeoutFn,
    clearTimeoutFn,
  });
  if (timeoutWindow) {
    pairingSession.expiresAt = timeoutWindow.expiresAt;
  }

  const renderVerificationCodeIfAvailable = () => {
    const verificationCode = pairingRuntime.getVerificationCode();
    if (!verificationCode || verificationCode === renderedVerificationCode) {
      return;
    }

    clearPairingPhaseIfNeeded();
    verificationPhaseActive = true;
    writeStderr(`${buildVerificationCodeScreen(verificationCode)}\n`);
    renderedVerificationCode = verificationCode;
  };

  const renderStatusMessageIfChanged = () => {
    const state = pairingRuntime.getState();
    if (state.isTerminal) {
      return;
    }
    if (state.message === lastRenderedStatusMessage) {
      return;
    }

    if (state.status !== 'pairing') {
      clearPairingPhaseIfNeeded();
    }
    if (state.status !== 'pairing' && state.status !== 'paired') {
      clearVerificationPhaseIfNeeded();
    }

    writeStderr(`${state.message}\n`);
    lastRenderedStatusMessage = state.message;
  };

  renderStatusMessageIfChanged();

  const unsubscribe = pairingRuntime.subscribe(() => {
    renderVerificationCodeIfAvailable();
    renderStatusMessageIfChanged();
  });

  try {
    terminalState = await pairingRuntime.waitForState(
      (state) => state.isTerminal,
    );
    if (terminalState) {
      terminalError = createTerminalStateError(pairingRuntime, terminalState);
    }
  } finally {
    unsubscribe();

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
