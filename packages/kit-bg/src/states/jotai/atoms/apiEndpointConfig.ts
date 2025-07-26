import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export interface IApiEndpointConfig {
  id: string;
  enabled: boolean;
  name: string;
  api: string;
  serviceModule: EServiceEndpointEnum;
}

export interface IApiEndpointConfigPersistAtom {
  configs: IApiEndpointConfig[];
}

export const {
  target: apiEndpointConfigPersistAtom,
  use: useApiEndpointConfigPersistAtom,
} = globalAtom<IApiEndpointConfigPersistAtom>({
  persist: true,
  name: EAtomNames.apiEndpointConfigPersistAtom,
  initialValue: {
    configs: [],
  },
});
