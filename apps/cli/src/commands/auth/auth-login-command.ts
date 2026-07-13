import type {
  ICliBotWalletEncryptedCredential,
  IPersistAuthSessionInput,
} from '@onekeyhq/shared/src/types/cliBotWallet';

import {
  createAuthLoginInterruptionCleanup,
  registerActiveAuthFlowCleanup,
} from '../../core/auth/auth-flow-interruption';
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

import { CliAuthManager } from './_internal/cli-auth-manager';
import {
  LoginPipelineError,
  routeAuthSession as defaultRouteAuthSession,
} from './_internal/login-pipeline';
import { executeHardwareLoginCommand } from './hardware-login-command';

import type { IHardwareSessionPersistInput } from './_internal/hardware-auth-manager';
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
  clearSession?(): Promise<void>;
  startAppTransferLogin(
    input?: StartAppTransferLoginInput,
  ): Promise<AppTransferLoginResult>;
  persistHardwareSession?(input: IHardwareSessionPersistInput): Promise<void>;
}

interface IExecuteAuthLoginCommandParams {
  output: OutputFormatter;
  appTransferFlag?: boolean;
  hardwareFlag?: boolean;
  deviceIdHint?: string;
  passphraseMode?: string;
  payload?: string;
  isHumanMode?: boolean;
  isTTY?: boolean;
  env?: IEndpointEnv;
  authManager?: IAuthLoginHandler;
  routeAuthSession?: typeof defaultRouteAuthSession;
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
  runHardwareLogin?: (deps: {
    output: OutputFormatter;
    isTTY: boolean;
    isHumanMode: boolean;
    deviceIdHint?: string;
    passphraseMode?: string;
    getStatus: () => Promise<ResolvedAuthSession>;
    persistSession: (input: IHardwareSessionPersistInput) => Promise<void>;
  }) => Promise<void>;
  exit?: (code: number) => void;
}

const MISSING_METHOD_MESSAGE =
  'Login method required. Use --app-transfer or --hardware.';
const MISSING_METHOD_SUGGESTION =
  'Run: onekey auth login --app-transfer | --hardware';
const CONFLICTING_METHODS_MESSAGE =
  '--app-transfer and --hardware are mutually exclusive.';
const CONFLICTING_METHODS_SUGGESTION = 'Pass only one of the two flags.';

function parseAuthPayload(rawPayload: string): IPersistAuthSessionInput {
  const trimmed = rawPayload.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
    } catch (error) {
      throw new AppError(
        ERROR_CODES.INVALID_PAYLOAD.code,
        'Invalid Bot Wallet payload.',
        'Paste the full payload exported by OneKey App.',
        { cause: error },
      );
    }
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'kind' in parsed &&
    'payload' in parsed
  ) {
    return parsed as IPersistAuthSessionInput;
  }

  return {
    kind: 'cli-bot-wallet',
    payload: parsed as ICliBotWalletEncryptedCredential,
  };
}

function normalizePayloadLoginError(error: unknown): Error {
  if (
    error instanceof LoginPipelineError ||
    (error instanceof Error && error.name === 'ZodError')
  ) {
    return new AppError(
      ERROR_CODES.INVALID_PAYLOAD.code,
      error.message,
      'Paste the full payload exported by OneKey App.',
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

function assertCompletedAppTransferSession(
  session: ResolvedAuthSession,
): ResolvedAuthSession {
  // displayAddress may legitimately be empty for bot wallets that have not
  // yet derived a first EVM address; sourceLabel still uniquely identifies
  // the source, so we no longer require displayAddress here.
  if (
    session.authStatus === 'authenticated' &&
    session.loginMethod === 'app_transfer' &&
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
      'Open Bot Wallet export to CLI in OneKey App, then enter the pairing code there.',
      'Opening the Pairing URI on desktop may not complete the export flow.',
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
    'Run this command in an interactive terminal.',
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
  appTransferFlag,
  hardwareFlag,
  deviceIdHint,
  passphraseMode,
  payload,
  isHumanMode = false,
  isTTY = false,
  env = 'prod',
  authManager = new CliAuthManager(),
  routeAuthSession: persistAuthSession = defaultRouteAuthSession,
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
  runHardwareLogin = executeHardwareLoginCommand,
  exit,
}: IExecuteAuthLoginCommandParams): Promise<void> {
  let shouldRunInterruptionCleanup = false;
  let releaseActiveAuthFlowCleanup: (() => void) | undefined;
  // True once we've invoked startAppTransferLogin — gates forcedExitCode so
  // early-return errors (no flag, already authenticated, no TTY) skip the
  // explicit process.exit() and let the caller finalize normally.
  let attemptedAppTransfer = false;
  let forcedExitCode: number | null = null;

  try {
    if (payload) {
      const currentSession = await authManager.getStatus();
      if (currentSession.authStatus === 'authenticated') {
        throw new AppError(
          ERROR_CODES.AUTH_WALLET_EXISTS.code,
          'Wallet already exists. Log out before importing another wallet.',
          'Run: onekey auth logout',
        );
      }

      const result = await persistAuthSession(parseAuthPayload(payload)).catch(
        (error) => {
          throw normalizePayloadLoginError(error);
        },
      );
      output.success(result.data);
      return;
    }

    if (appTransferFlag && hardwareFlag) {
      output.error({
        code: ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        message: CONFLICTING_METHODS_MESSAGE,
        suggestion: CONFLICTING_METHODS_SUGGESTION,
      });
      process.exitCode = ERROR_CODES.PARAM_MISSING_REQUIRED.exitCode;
      return;
    }

    if (!appTransferFlag && !hardwareFlag) {
      output.error({
        code: ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        message: MISSING_METHOD_MESSAGE,
        suggestion: MISSING_METHOD_SUGGESTION,
      });
      process.exitCode = ERROR_CODES.PARAM_MISSING_REQUIRED.exitCode;
      return;
    }

    if (deviceIdHint && !hardwareFlag) {
      output.error({
        code: ERROR_CODES.PARAM_INVALID_CONFIG.code,
        message: '--device-id is only valid with --hardware.',
        suggestion:
          'Add --hardware, or drop --device-id for App Transfer login.',
      });
      process.exitCode = ERROR_CODES.PARAM_INVALID_CONFIG.exitCode;
      return;
    }

    if (passphraseMode && !hardwareFlag) {
      output.error({
        code: ERROR_CODES.PARAM_INVALID_CONFIG.code,
        message: '--passphrase-mode is only valid with --hardware.',
        suggestion:
          'Add --hardware, or drop --passphrase-mode for App Transfer login.',
      });
      process.exitCode = ERROR_CODES.PARAM_INVALID_CONFIG.exitCode;
      return;
    }

    if (hardwareFlag) {
      try {
        if (typeof authManager.persistHardwareSession !== 'function') {
          throw new AppError(
            ERROR_CODES.AUTH_SESSION_PERSIST_FAILED.code,
            'Auth manager does not support hardware login.',
            'Use the default CLI auth manager or provide one with persistHardwareSession.',
          );
        }
        await runHardwareLogin({
          output,
          isTTY,
          isHumanMode,
          deviceIdHint,
          passphraseMode,
          getStatus: () => authManager.getStatus(),
          persistSession: (input) => authManager.persistHardwareSession!(input),
        });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
      return;
    }

    if (!isTTY) {
      throw createAppTransferRequiresTTYError();
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

    attemptedAppTransfer = true;
    const result = await authManager.startAppTransferLogin({
      endpointEnv: env,
    });

    try {
      if (isHumanMode && isTTY) {
        await runPairingDisplay(result);
      } else {
        await waitForHeadlessCompletion(result);
      }
    } catch (error) {
      throw buildAuthLoginInterruptionError(AppError.from(error));
    }

    const finalSession = assertCompletedAppTransferSession(
      await authManager.getStatus(),
    );
    shouldRunInterruptionCleanup = false;
    output.success(presentAuthLoginResult(finalSession));
    forcedExitCode = 0;
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
