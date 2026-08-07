import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type {
  IDevSettings,
  IDevSettingsKeys,
  IDevSettingsPersistAtom,
} from '../states/jotai/atoms/devSettings';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export function syncDevelopmentDesktopSettings(_params: {
  devSettings: IDevSettingsPersistAtom;
}): void {}

export async function getDevelopmentDesktopSettingsAfterDisable(_params: {
  previousDevSettings: IDevSettingsPersistAtom;
}): Promise<IDevSettings> {
  return {};
}

export function validateDevelopmentDesktopSettingUpdate(_params: {
  name: IDevSettingsKeys;
  value: IDevSettings[IDevSettingsKeys];
  previousDevSettings: IDevSettingsPersistAtom;
}): void {}

export function rejectDevelopmentDesktopConnectionRequestIfNeeded(_params: {
  request: IJsBridgeMessagePayload;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  return Promise.resolve();
}
