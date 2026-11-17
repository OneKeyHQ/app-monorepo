import platformEnv from '@onekeyhq/shared/src/platformEnv';

let channel: BroadcastChannel | undefined;

export function initializeLogResetListener(onReset: () => void) {
  if (!platformEnv.isWeb || typeof globalThis.BroadcastChannel !== 'function')
    return;
  channel?.close();
  try {
    channel = new BroadcastChannel('onekey-diagnostic-logs-reset');
  } catch {
    // Restricted browser contexts must not break app startup for diagnostics.
    channel = undefined;
    return;
  }
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data === 'reset') {
      channel?.close();
      channel = undefined;
      onReset();
    }
  };
}

export function notifyLogReset() {
  channel?.postMessage('reset');
  channel?.close();
  channel = undefined;
}
