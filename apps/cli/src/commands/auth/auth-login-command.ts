import {
  createAuthLoginInterruptionCleanup,
  registerActiveAuthFlowCleanup,
} from '../../core/auth/auth-flow-interruption';
import { AuthManager } from '../../core/auth/auth-manager';
import { runAppTransferPairingDisplay } from '../../core/prime-transfer/pairing-display-runtime';
import {
  getActiveTransferPairingRuntime,
  getTransferPairingRuntimeError,
  replaceActiveTransferPairingRuntime,
  startTransferPairingRuntimeTimeout,
} from '../../core/prime-transfer/pairing-session-runtime';
import { AppError, ERROR_CODES } from '../../errors';
import {
  presentAuthLoginResult,
  presentInterruptedAuthLoginResult,
} from '../../output/auth-presenters';

import { promptForAuthLoginMethod } from './auth-prompt-utils';
import { executeMnemonicLoginCommand } from './mnemonic-login-command';

import type { IEndpointEnv } from '../../config';
import type {
  AppTransferLoginResult,
  ResolvedAuthSession,
  StartAppTransferLoginInput,
} from '../../core/auth/auth-types';
import type { ITransferStateSnapshot } from '../../core/prime-transfer/transfer-types';
import type { OutputFormatter } from '../../output';

interface IAuthLoginHandler {
  getStatus(): Promise<ResolvedAuthSession>;
  loginWithMnemonic(rawMnemonic: string): Promise<{ address: string }>;
  clearSession?(): Promise<void>;
  startAppTransferLogin(
    input?: StartAppTransferLoginInput,
  ): Promise<AppTransferLoginResult>;
}

interface IExecuteAuthLoginCommandParams {
  output: OutputFormatter;
  mnemonicFlag?: boolean;
  appTransferFlag?: boolean;
  isHumanMode?: boolean;
  isTTY?: boolean;
  env?: IEndpointEnv;
  authManager?: IAuthLoginHandler;
  selectMethod?: () => Promise<'mnemonic' | 'app_transfer'>;
  readInput?: () => Promise<string>;
  stderr?: {
    isTTY?: boolean;
    write(chunk: string | Uint8Array): boolean;
  };
  runAppTransferPairingDisplay?: (
    pairingSession: AppTransferLoginResult,
  ) => Promise<void>;
  waitForHeadlessAppTransferCompletion?: (
    pairingSession: AppTransferLoginResult,
  ) => Promise<void>;
  exit?: (code: number) => void;
}

const MISSING_METHOD_MESSAGE =
  'Login method required. Use --mnemonic or --app-transfer.';
const MISSING_METHOD_SUGGESTION =
  'Run: onekey auth login --mnemonic or onekey auth login --app-transfer';

function assertCompletedAppTransferSession(
  session: ResolvedAuthSession,
): ResolvedAuthSession {
  if (
    session.authStatus === 'authenticated' &&
    session.loginMethod === 'app_transfer' &&
    session.displayAddress &&
    session.sourceLabel
  ) {
    return session;
  }

  throw new AppError(
    ERROR_CODES.AUTH_SESSION_INVALID.code,
    'App Transfer completed without a valid auth session',
    'Retry the App Transfer login flow',
  );
}

function resolveActivePairingRuntime(pairingSession: AppTransferLoginResult) {
  const runtime = getActiveTransferPairingRuntime();
  if (!runtime || runtime.pairingCode !== pairingSession.pairingCode) {
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      'App Transfer pairing session is unavailable',
      'Retry the App Transfer login flow',
    );
  }

  return runtime;
}

function createHeadlessAppTransferTerminalError(
  runtime: ReturnType<typeof resolveActivePairingRuntime>,
  session: ITransferStateSnapshot,
): AppError | null {
  if (session.status === 'completed') {
    return null;
  }

  if (session.status === 'cancelled') {
    return new AppError(
      ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
      session.message,
      'Retry the App Transfer login flow',
    );
  }

  if (session.status === 'timeout') {
    return new AppError(
      ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code,
      session.message,
      'Retry the App Transfer login flow',
    );
  }

  return (
    getTransferPairingRuntimeError(runtime) ??
    new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      session.message,
      'Retry the App Transfer login flow',
    )
  );
}

function writeHeadlessAppTransferInstructions(
  pairingSession: AppTransferLoginResult,
  stderr: { write(chunk: string | Uint8Array): boolean },
): void {
  stderr.write(
    [
      'Complete App Transfer pairing in OneKey App with the details below.',
      `Pairing code: ${pairingSession.pairingCode}`,
      `Pairing URI: ${pairingSession.pairingPayload.uri}`,
      '',
    ].join('\n'),
  );
}

function writeHeadlessAppTransferVerificationCode(
  verificationCode: string,
  stderr: { write(chunk: string | Uint8Array): boolean },
): void {
  stderr.write(
    [
      'Verification code:',
      verificationCode,
      'Enter this code in OneKey App to confirm the export.',
      '',
    ].join('\n'),
  );
}

async function waitForHeadlessAppTransferCompletion(
  pairingSession: AppTransferLoginResult,
  {
    stderr = process.stderr,
    shouldWriteInstructions = true,
  }: {
    stderr?: { write(chunk: string | Uint8Array): boolean };
    shouldWriteInstructions?: boolean;
  } = {},
): Promise<void> {
  const runtime = resolveActivePairingRuntime(pairingSession);
  let terminalState: ReturnType<typeof runtime.getState> | undefined;
  let terminalError: AppError | null = null;
  let renderedVerificationCode: string | null = null;
  let verificationCodePollHandle: ReturnType<typeof setInterval> | undefined;

  if (shouldWriteInstructions) {
    writeHeadlessAppTransferInstructions(pairingSession, stderr);
    verificationCodePollHandle = setInterval(() => {
      const verificationCode = runtime.getVerificationCode();
      if (!verificationCode || verificationCode === renderedVerificationCode) {
        return;
      }

      writeHeadlessAppTransferVerificationCode(verificationCode, stderr);
      renderedVerificationCode = verificationCode;
    }, 80);
  }
  const timeoutWindow = startTransferPairingRuntimeTimeout(runtime, {
    timeoutMs: pairingSession.timeoutMs,
  });
  if (timeoutWindow) {
    pairingSession.expiresAt = timeoutWindow.expiresAt;
  }

  try {
    terminalState = await runtime.waitForState((state) => state.isTerminal);
    if (terminalState) {
      terminalError = createHeadlessAppTransferTerminalError(
        runtime,
        terminalState,
      );
    }
  } finally {
    if (verificationCodePollHandle) {
      clearInterval(verificationCodePollHandle);
    }

    if (runtime.getState().isTerminal) {
      if (getActiveTransferPairingRuntime() === runtime) {
        await replaceActiveTransferPairingRuntime(null);
      } else {
        await runtime.dispose();
      }
    }
  }

  if (!terminalState) {
    return;
  }

  if (terminalError) {
    throw AppError.from(terminalError);
  }
}

function createAppTransferRequiresTTYError(): AppError {
  return new AppError(
    ERROR_CODES.PARAM_REQUIRES_TTY.code,
    'App Transfer login requires an interactive TTY terminal.',
    'Run this command in an interactive terminal, or use --mnemonic until a dedicated non-interactive App Transfer mode is available.',
  );
}

function buildAuthLoginInterruptionError(appError: AppError): AppError {
  if (appError.code === ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code) {
    return new AppError(appError.code, appError.message, appError.suggestion, {
      cause: appError,
      details: presentInterruptedAuthLoginResult(
        'timeout',
        'retry_app_transfer',
      ),
    });
  }

  if (appError.code === ERROR_CODES.AUTH_TRANSFER_CANCELLED.code) {
    return new AppError(appError.code, appError.message, appError.suggestion, {
      cause: appError,
      details: presentInterruptedAuthLoginResult(
        'cancelled',
        'retry_app_transfer',
      ),
    });
  }

  return appError;
}

export async function executeAuthLoginCommand({
  output,
  mnemonicFlag,
  appTransferFlag,
  isHumanMode = false,
  isTTY = false,
  env = 'test',
  authManager = new AuthManager(),
  selectMethod = promptForAuthLoginMethod,
  readInput,
  stderr = process.stderr,
  runAppTransferPairingDisplay:
    runPairingDisplay = runAppTransferPairingDisplay,
  waitForHeadlessAppTransferCompletion: waitForHeadlessCompletion = (
    pairingSession,
  ) => {
    const outputMode =
      typeof (output as OutputFormatter & { getMode?: () => string })
        .getMode === 'function'
        ? output.getMode()
        : undefined;
    const shouldWriteInstructions =
      outputMode !== 'quiet' &&
      (outputMode !== 'agent' || Boolean(stderr.isTTY));

    return waitForHeadlessAppTransferCompletion(pairingSession, {
      stderr,
      shouldWriteInstructions,
    });
  },
  exit,
}: IExecuteAuthLoginCommandParams): Promise<void> {
  let shouldRunInterruptionCleanup = false;
  let releaseActiveAuthFlowCleanup: (() => void) | undefined;
  let attemptedAppTransfer = false;
  let forcedExitCode: number | null = null;
  const markInterruptionCleanupHandled = () => {
    shouldRunInterruptionCleanup = false;
  };

  try {
    if (mnemonicFlag && appTransferFlag) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CONFIG.code,
        'Choose only one login method flag',
        'Use either --mnemonic or --app-transfer',
      );
    }

    let requestedMethod: 'mnemonic' | 'app_transfer' | undefined;
    if (mnemonicFlag) {
      requestedMethod = 'mnemonic';
    } else if (appTransferFlag) {
      requestedMethod = 'app_transfer';
    }

    if (!requestedMethod && (!isHumanMode || !isTTY)) {
      output.error({
        code: ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        message: MISSING_METHOD_MESSAGE,
        suggestion: MISSING_METHOD_SUGGESTION,
      });
      process.exitCode = ERROR_CODES.PARAM_MISSING_REQUIRED.exitCode;
      return;
    }

    const currentSession = await authManager.getStatus();
    if (currentSession.authStatus === 'authenticated') {
      throw new AppError(
        ERROR_CODES.AUTH_WALLET_EXISTS.code,
        'Wallet already exists. Log out before importing another wallet.',
        'Run: onekey auth logout',
      );
    }

    if (typeof authManager.clearSession === 'function') {
      shouldRunInterruptionCleanup = true;
      const cleanup = createAuthLoginInterruptionCleanup({
        clearSession: async () => {
          await authManager.clearSession?.();
        },
      });
      releaseActiveAuthFlowCleanup = registerActiveAuthFlowCleanup(async () => {
        if (!shouldRunInterruptionCleanup) {
          return;
        }
        await cleanup();
      });
    }

    if (mnemonicFlag) {
      await executeMnemonicLoginCommand({
        output,
        requiresMnemonicFlag: false,
        mnemonicFlag: true,
        missingMethodMessage: MISSING_METHOD_MESSAGE,
        missingMethodSuggestion: MISSING_METHOD_SUGGESTION,
        authManager,
        readInput,
        beforeFinalize: markInterruptionCleanupHandled,
      });
      return;
    }

    for (;;) {
      attemptedAppTransfer = false;
      const selectedMethod = requestedMethod ?? (await selectMethod());
      if (selectedMethod === 'mnemonic') {
        await executeMnemonicLoginCommand({
          output,
          requiresMnemonicFlag: false,
          mnemonicFlag: true,
          missingMethodMessage: MISSING_METHOD_MESSAGE,
          missingMethodSuggestion: MISSING_METHOD_SUGGESTION,
          authManager,
          readInput,
          beforeFinalize: markInterruptionCleanupHandled,
        });
        return;
      }

      if (!isTTY) {
        throw createAppTransferRequiresTTYError();
      }

      attemptedAppTransfer = true;
      const result = await authManager.startAppTransferLogin({
        endpointEnv: env,
      });
      let shouldRestartSelection = false;

      try {
        if (isHumanMode && isTTY) {
          await runPairingDisplay(result);
        } else {
          await waitForHeadlessCompletion(result);
        }
      } catch (error) {
        const appError = AppError.from(error);
        if (
          requestedMethod ||
          !isHumanMode ||
          !isTTY ||
          appError.code !== ERROR_CODES.AUTH_TRANSFER_CANCELLED.code
        ) {
          throw buildAuthLoginInterruptionError(appError);
        }

        shouldRestartSelection = true;
        await replaceActiveTransferPairingRuntime(null);
      }

      if (!shouldRestartSelection) {
        const finalSession = assertCompletedAppTransferSession(
          await authManager.getStatus(),
        );
        shouldRunInterruptionCleanup = false;
        output.success(presentAuthLoginResult(finalSession));
        forcedExitCode = 0;
        return;
      }
    }
  } catch (error) {
    shouldRunInterruptionCleanup = false;
    const appError = AppError.from(error);
    output.error(appError.toErrorDetail());
    process.exitCode = appError.exitCode;
    if (attemptedAppTransfer) {
      forcedExitCode = appError.exitCode;
    }
  } finally {
    releaseActiveAuthFlowCleanup?.();
    if (forcedExitCode !== null) {
      exit?.(forcedExitCode);
    }
  }
}
