import type {
  ETranslateDisplayMode,
  ETranslateEngine,
} from '@onekeyhq/shared/types/discovery';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class TranslationScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public dappTranslateToggle(params: {
    action: 'enable' | 'disable';
    engine: ETranslateEngine;
    targetLang: string;
    displayMode: ETranslateDisplayMode;
    dappDomain: string;
  }) {
    return params;
  }
}
