import type {
  IInjectedProviderNamesStrings,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { Features, IDeviceType } from '@onekeyfe/hd-core';

export type IOneKeyDeviceType = IDeviceType;

export type IOneKeyDeviceFeatures = Features;

export type IDappSourceInfo = {
  id: string | number; // ServicePromise callback id to reject/resolve
  origin: string;
  hostname: string;
  scope: IInjectedProviderNamesStrings;
  data: IJsonRpcRequest;
};
