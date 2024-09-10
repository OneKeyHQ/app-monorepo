import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class WebSocketScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  logSensitiveMessage(a: number, b: number) {
    return [a, b, devOnlyData('this is a sensitive message')];
  }
}
