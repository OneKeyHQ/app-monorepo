import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BaseScene } from '../../../base/baseScene';
import { loggerConfig } from '../../../loggerConfig';

export class AccountSelectorDevOnlyScene extends BaseScene {
  override _emitLog(
    methodName: string,
    args: unknown[],
    metadataList: Parameters<BaseScene['_emitLog']>[2],
  ) {
    if (
      !platformEnv.isDev ||
      !loggerConfig.shouldLog(this.scopeName, this.sceneName)
    ) {
      return undefined;
    }
    return super._emitLog(methodName, args, metadataList);
  }
}
