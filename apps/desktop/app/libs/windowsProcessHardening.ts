// cspell:ignore dacl
import type {
  CrashHandlerStartResult,
  HardeningResult,
  StageResult,
} from '@onekeyfe/electron-windows-process-hardening';

type FailedStage = Extract<StageResult, { status: 'failed' }>;

export function startLocalCrashHandler(): CrashHandlerStartResult {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native =
      require('@onekeyfe/electron-windows-process-hardening') as typeof import('@onekeyfe/electron-windows-process-hardening');
    return native.startLocalCrashHandler();
  } catch {
    return { status: 'failed', message: 'handler_start' };
  }
}

export function hardenCurrentProcess(): HardeningResult {
  // Keep the native binding behind the caller's Windows/production/opt-out gate.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native =
      require('@onekeyfe/electron-windows-process-hardening') as typeof import('@onekeyfe/electron-windows-process-hardening');
    return native.hardenCurrentProcess();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      dacl: { status: 'failed', message },
      extensionPoint: { status: 'failed', message },
    };
  }
}

export function processHardeningStageError(
  stage: string,
  result: FailedStage,
): Error {
  const code =
    result.win32Error === undefined ? '' : ` (Win32 ${result.win32Error})`;
  return new Error(`${stage}: ${result.message}${code}`);
}
