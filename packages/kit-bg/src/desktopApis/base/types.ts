import type { DESKTOP_API_MESSAGE_TYPE } from './consts';
import type { IDesktopApi } from '../instance/IDesktopApi';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

export type IDesktopApiKeys = keyof IDesktopApi;
export type IDesktopApiMessagePayload = IJsonRpcRequest & {
  type: typeof DESKTOP_API_MESSAGE_TYPE;
  module: IDesktopApiKeys;
};
export { IDesktopApi };
