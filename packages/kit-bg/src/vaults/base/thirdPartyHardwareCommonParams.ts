import type { ICommonCallParams } from '@onekeyfe/hwk-adapter-core';

// Auto multi-network fill (onboarding + add-account) suppresses the per-app
// install prompt; manual / single-network add keeps the SDK default (prompt).
export function thirdPartyCommonCallParamsForCreateScene(scene: {
  isAutoCreateMultiNetwork?: boolean;
}): ICommonCallParams | undefined {
  return scene.isAutoCreateMultiNetwork ? { autoInstallApp: false } : undefined;
}
