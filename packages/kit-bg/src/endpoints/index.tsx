import { settingsPersistAtom } from '../states/jotai/atoms';

import { endpointsMap } from './endpointsMap';

export async function getEndpoint() {
  const settings = await settingsPersistAtom.get();
  return endpointsMap[settings.endpointType];
}
