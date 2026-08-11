import type { IDevSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export type ICustomInjectionConnectionRequest = IJsBridgeMessagePayload & {
  isCustomInjectionRequest?: boolean;
};

export function shouldMuteCustomInjectionConnectionRequest({
  request,
  devSettings,
}: {
  request: ICustomInjectionConnectionRequest;
  devSettings: IDevSettingsPersistAtom;
}) {
  const customInjection = devSettings.settings?.customInjection;
  return Boolean(
    request.isCustomInjectionRequest &&
    devSettings.enabled &&
    customInjection?.enabled &&
    customInjection.muteConnectionRequests,
  );
}
