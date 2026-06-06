import type { ICommonCallParams } from '@onekeyfe/hwk-adapter-core';

export function thirdPartyCommonCallParamsForCreateScene(scene: {
  isAutoCreateMultiNetwork?: boolean;
}): ICommonCallParams | undefined {
  return scene.isAutoCreateMultiNetwork ? { autoInstallApp: false } : undefined;
}
