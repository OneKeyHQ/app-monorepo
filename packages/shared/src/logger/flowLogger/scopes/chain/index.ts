/* eslint-disable max-classes-per-file */
import debugLogger from '../../../debugLogger';
import { FlowLoggerScopeBase } from '../../base/FlowLoggerScopeBase';

import type { LoggerEntity } from '../../../debugLogger';

class SceneCommon {
  //
}

export default class extends FlowLoggerScopeBase {
  protected override scopeName = 'chain';

  protected override logger: LoggerEntity = debugLogger.flowChain;

  public common: SceneCommon = this._createSceneProxy('common') as SceneCommon;

  private _common = () => SceneCommon;
}
