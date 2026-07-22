import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

const LOG_PREFIX = '[DAPP-WEBVIEW]';

let instanceSequence = 0;

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createDebugWebViewInstanceId(scope: 'content' | 'mobile') {
  instanceSequence += 1;
  return `${scope}-${instanceSequence}`;
}

export function formatDebugTabId(tabId?: string | null) {
  if (!tabId) {
    return 'none';
  }
  if (tabId === 'home') {
    return tabId;
  }
  return tabId.slice(-6);
}

export function debugWebViewLifecycleLog(label: string, value?: unknown) {
  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  try {
    NativeLogger.write(LogLevel.Info, `${LOG_PREFIX} ${label}${valueText}`);
  } catch {
    // Keep lifecycle diagnostics from affecting browser behavior.
  }
}
