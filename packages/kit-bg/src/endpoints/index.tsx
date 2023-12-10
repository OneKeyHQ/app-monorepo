import { settingsPersistAtom } from '../states/jotai/atoms';

import { endpointsMap } from './endpointsMap';

export async function getBaseEndpoint() {
  const settings = await settingsPersistAtom.get();
  return endpointsMap.base[settings.endpointType];
}
