import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import type { IDevSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';

export function isStandardLiveActivityTestEndpoint({
  enabled,
  settings,
}: IDevSettingsPersistAtom) {
  return (
    !!enabled &&
    !!settings?.enableTestEndpoint &&
    !settings.customApiEndpoints?.some(
      ({ enabled: customEnabled, serviceModule, api }) =>
        customEnabled &&
        (serviceModule === EServiceEndpointEnum.Notification ||
          serviceModule === EServiceEndpointEnum.Swap) &&
        api !== endpointsMap.test[serviceModule],
    )
  );
}
