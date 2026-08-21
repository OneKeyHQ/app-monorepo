import {
  LogLevel,
  NativeLogger,
} from '../../modules3rdParty/react-native-file-logger';
import platformEnv from '../../platformEnv';

const LOG_PREFIX = '[OK-60835][TabBar][JS]';

let instanceSequence = 0;

function stringifyLogValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createOk60835TabBarLogInstance(scope: string): string {
  instanceSequence += 1;
  return `${scope}#${instanceSequence}`;
}

/** Temporary release-build diagnostics for the OK-60835 QA reproduction. */
export function ok60835TabBarLog(label: string, value?: unknown): void {
  if (!platformEnv.isNativeIOS) {
    return;
  }

  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  try {
    NativeLogger.write(LogLevel.Info, `${LOG_PREFIX} ${label}${valueText}`);
  } catch {
    // Diagnostics must never affect navigation behavior if the logger is unavailable.
  }
}
