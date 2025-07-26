import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

export type { IApiEndpointConfig } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

export type IFormData = {
  name: string;
  api: string;
  serviceModule: EServiceEndpointEnum;
  enabled: boolean;
};
