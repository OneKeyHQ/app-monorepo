import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export type ICustomInjectionRequestPayload = IJsBridgeMessagePayload & {
  isCustomInjectionRequest?: boolean;
};

export type ICustomInjectionHostRequest = ICustomInjectionRequestPayload & {
  isCustomInjectionRequest: boolean;
};

export function stampCustomInjectionRequestContext(
  payload: ICustomInjectionRequestPayload,
  hasCustomInjectionPreload: boolean,
): ICustomInjectionHostRequest {
  return {
    ...payload,
    // Always overwrite a page-provided value at the trusted host boundary.
    isCustomInjectionRequest: hasCustomInjectionPreload,
  };
}
