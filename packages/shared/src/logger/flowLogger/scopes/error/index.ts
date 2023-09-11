/* eslint-disable max-classes-per-file */
import debugLogger from '../../../debugLogger';
import { FlowLoggerScopeBase } from '../../base/FlowLoggerScopeBase';

import type { LoggerEntity } from '../../../debugLogger';

class SceneError {
  error(...args: Array<Error | string | unknown>): any {
    return args;
  }
}

export default class extends FlowLoggerScopeBase {
  protected override scopeName = 'error';

  protected override logger: LoggerEntity = debugLogger.flowError;

  private error: SceneError = this._createSceneProxy('error') as SceneError;

  private _error = () => SceneError;

  log(...args: Array<Error | string | unknown>): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.error(...args);
    }
    return this.error.error(...args) as unknown as Promise<void>;
  }
}
