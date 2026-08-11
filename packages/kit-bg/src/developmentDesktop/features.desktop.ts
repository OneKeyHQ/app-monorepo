import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { devSettingSyncStorage } from '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance';
import { syncStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import type {
  EAppSyncStorageKeys,
  EDevSettingSyncStorageKeys,
} from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import { shouldMuteCustomInjectionConnectionRequest } from '../services/utils/customInjectionConnectionRequest';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type {
  IDevSettings,
  IDevSettingsKeys,
  IDevSettingsPersistAtom,
} from '../states/jotai/atoms/devSettings';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const CUSTOM_INJECTION_APP_SYNC_STORAGE_KEY =
  'onekey_custom_injection_enabled' as EAppSyncStorageKeys;
const CUSTOM_INJECTION_DEV_SETTING_SYNC_STORAGE_KEY =
  'onekey_custom_injection_enabled' as EDevSettingSyncStorageKeys;

export function syncDevelopmentDesktopSettings({
  devSettings,
}: {
  devSettings: IDevSettingsPersistAtom;
}): void {
  const enabled = Boolean(
    devSettings.enabled && devSettings.settings?.customInjection?.enabled === true,
  );
  devSettingSyncStorage.set(
    CUSTOM_INJECTION_DEV_SETTING_SYNC_STORAGE_KEY,
    enabled,
  );
  syncStorage.set(CUSTOM_INJECTION_APP_SYNC_STORAGE_KEY, enabled);
}

export async function getDevelopmentDesktopSettingsAfterDisable({
  previousDevSettings,
}: {
  previousDevSettings: IDevSettingsPersistAtom;
}): Promise<IDevSettings> {
  if (previousDevSettings.settings?.customInjection?.enabled) {
    const activeSession = await globalThis.desktopApiProxy?.webview
      ?.getActiveCustomInjectedWorkspace?.()
      .catch(() => null);
    if (activeSession?.sessionId) {
      await globalThis.desktopApiProxy.webview
        .closeCustomInjectedWorkspace(activeSession.sessionId)
        .catch(() => undefined);
    }
  }

  return previousDevSettings.settings?.customInjection
    ? { customInjection: previousDevSettings.settings.customInjection }
    : {};
}

export function validateDevelopmentDesktopSettingUpdate({
  name,
  value,
  previousDevSettings,
}: {
  name: IDevSettingsKeys;
  value: IDevSettings[IDevSettingsKeys];
  previousDevSettings: IDevSettingsPersistAtom;
}): void {
  if (name !== 'customInjection') {
    return;
  }
  if (!previousDevSettings.enabled) {
    throw new OneKeyLocalError('Custom injection requires enabled developer settings');
  }
  const customInjection = value as IDevSettings['customInjection'] | undefined;
  if (
    !customInjection ||
    typeof customInjection.enabled !== 'boolean' ||
    typeof customInjection.workspace !== 'string' ||
    customInjection.workspace.length > 4096
  ) {
    throw new OneKeyLocalError('Custom injection settings are invalid');
  }
}

export async function rejectDevelopmentDesktopConnectionRequestIfNeeded({
  request,
  backgroundApi,
}: {
  request: IJsBridgeMessagePayload;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const devSettings = await devSettingsPersistAtom.get();
  if (!shouldMuteCustomInjectionConnectionRequest({ request, devSettings })) {
    return;
  }

  await backgroundApi.serviceApp.showToast({
    method: 'message',
    title: 'Connection request muted',
    message: 'To show it again, turn off “Mute connection requests” in Custom Injection Settings.',
    toastId: 'custom-injection-connection-request-muted',
  });
  throw web3Errors.provider.userRejectedRequest();
}
