import { isString } from 'lodash';

import { isPromiseObject } from '../../../utils/promiseUtils';
import { dangerouslyLogInfo } from '../../debugLogger';

import type { LoggerEntity } from '../../debugLogger';

export abstract class FlowLoggerScopeBase {
  protected abstract scopeName: string;

  protected abstract logger: LoggerEntity;

  private sceneProxyCache: {
    [sceneName: string]: any;
  } = {};

  protected _createSceneProxy(sceneName: string) {
    if (this.sceneProxyCache[sceneName] !== undefined) {
      throw new Error(
        `FlowLoggerScopeBase _createSceneProxy ERROR, sceneName already defined: ${sceneName}`,
      );
    }
    this.sceneProxyCache[sceneName] = null;
    const NOOP = new Proxy(
      {},
      {
        get:
          (target, prop) =>
          async (...args: any[]) => {
            // console.log(target, prop, args, others, this.scopeName, name);
            const method = prop;
            if (!isString(method)) {
              throw new Error('FlowLogger scene method must be string');
            }
            let sceneInstance = this.sceneProxyCache[sceneName];
            if (!sceneInstance) {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              const sceneClass = await this[`_${sceneName}`]();
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, new-cap
              sceneInstance = new sceneClass();
            }
            this.sceneProxyCache[sceneName] = sceneInstance;
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            let result = sceneInstance[method](...args);
            if (isPromiseObject(result)) {
              result = await result;
            }
            const logAction = dangerouslyLogInfo(
              this.logger,
              `🅵🅻🅾🆆 ${this.scopeName}->${sceneName}->${method} 🅸`,
              ...[].concat(result),
            );
            if (isPromiseObject(logAction)) {
              await logAction;
            }
          },
      },
    );
    return NOOP;
  }
}
