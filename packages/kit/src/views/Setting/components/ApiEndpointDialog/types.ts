import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

export type IFormData = {
  name: string;
  api: string;
  serviceModule: EServiceEndpointEnum;
  enabled: boolean;
};
