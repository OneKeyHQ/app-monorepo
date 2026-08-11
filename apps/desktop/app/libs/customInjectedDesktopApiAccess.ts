import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { devSettingSyncStorage } from '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance';
import { syncStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import {
  EAppSyncStorageKeys,
  EDevSettingSyncStorageKeys,
} from '@onekeyhq/shared/src/storage/syncStorageKeys';

const CUSTOM_INJECTION_APP_SYNC_STORAGE_KEY =
  'onekey_custom_injection_enabled' as EAppSyncStorageKeys;
const CUSTOM_INJECTION_DEV_SETTING_SYNC_STORAGE_KEY =
  'onekey_custom_injection_enabled' as EDevSettingSyncStorageKeys;

const CUSTOM_INJECTED_WEBVIEW_API_METHODS = new Set([
  'activateCustomInjectedWorkspace',
  'closeCustomInjectedWorkspace',
  'focusCustomInjectedE2EWebView',
  'generateCustomInjectedE2E',
  'getActiveCustomInjectedWorkspace',
  'getCustomInjectedDappDirectory',
  'getCustomInjectedE2EState',
  'getCustomInjectedE2EStates',
  'getCustomInjectedOperationLogAppStartedAt',
  'getCustomInjectedRecentOperationLogs',
  'getCustomInjectedWorkspace',
  'logCustomInjectedClientOperation',
  'openCustomInjectedDappDirectory',
  'openCustomInjectedOperationLogFile',
  'prepareCustomInjectedE2EPreload',
  'prepareCustomInjectedE2EValidation',
  'prepareCustomInjectedWorkspace',
  'processCustomInjectedAutoReview',
  'refreshCustomInjectedProtocols',
  'runCustomInjectedE2E',
  'saveCustomInjectedRecording',
  'selectCustomInjectedWorkspace',
  'stopCustomInjectedE2E',
  'stopCustomInjectedE2EGeneration',
  'updateCustomInjectedProtocol',
]);

export type ICustomInjectedDesktopApiAccessState = {
  customInjectionEnabled: boolean;
  developerModeEnabled: boolean;
};

export function resolveCustomInjectedDesktopApiAccessFlag(
  primary: boolean | undefined,
  fallback: boolean | undefined,
): boolean {
  return (primary ?? fallback) === true;
}

export function getCustomInjectedDesktopApiAccessState(): ICustomInjectedDesktopApiAccessState {
  return {
    developerModeEnabled: resolveCustomInjectedDesktopApiAccessFlag(
      devSettingSyncStorage.getBoolean(
        EDevSettingSyncStorageKeys.onekey_developer_mode_enabled,
      ),
      syncStorage.getBoolean(
        EAppSyncStorageKeys.onekey_developer_mode_enabled,
      ),
    ),
    customInjectionEnabled: resolveCustomInjectedDesktopApiAccessFlag(
      devSettingSyncStorage.getBoolean(
        CUSTOM_INJECTION_DEV_SETTING_SYNC_STORAGE_KEY,
      ),
      syncStorage.getBoolean(CUSTOM_INJECTION_APP_SYNC_STORAGE_KEY),
    ),
  };
}

export function assertCustomInjectedDesktopApiAccess({
  method,
  module,
  state = getCustomInjectedDesktopApiAccessState(),
}: {
  method: string;
  module: string;
  state?: ICustomInjectedDesktopApiAccessState;
}): void {
  if (module !== 'webview' || !method.includes('CustomInjected')) {
    return;
  }
  if (!CUSTOM_INJECTED_WEBVIEW_API_METHODS.has(method)) {
    throw new OneKeyLocalError(
      `DESKTOP_API_CALL: disallowed Custom Injection method "${method}"`,
    );
  }
  if (!state.developerModeEnabled) {
    throw new OneKeyLocalError(
      'Custom Injection Desktop APIs require enabled developer settings',
    );
  }
  if (!state.customInjectionEnabled) {
    throw new OneKeyLocalError(
      'Custom Injection Desktop APIs require the Custom Injection switch',
    );
  }
}

export function isAllowedCustomInjectedWebviewApiMethod(
  method: string,
): boolean {
  return CUSTOM_INJECTED_WEBVIEW_API_METHODS.has(method);
}
