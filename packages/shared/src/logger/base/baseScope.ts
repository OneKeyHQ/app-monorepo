import { InteractionManager } from 'react-native';

import { formatTime } from '../../utils/dateUtils';
import { isPromiseObject } from '../../utils/promiseUtils';
import { stringifyFunc } from '../stringifyFunc';
import { Metadata } from '../types';

import { logFn } from './logFn';

import type { BaseScene } from './baseScene';
import type { EScopeName, IScope } from '../types';

export abstract class BaseScope implements IScope {
  protected abstract scopeName: EScopeName;

  private cache: Record<string, any> = {};

  getName(): EScopeName {
    return this.scopeName;
  }

  createScene<T extends BaseScene>(
    sceneName: string,
    SceneClass: new () => T,
  ): T {
    const NOOP = new Proxy({} as T, {
      get:
        (target, prop) =>
        (...args: any[]) => {
          try {
            const now = new Date();
            const instance =
              this.cache[sceneName] ||
              (this.cache[sceneName] = new SceneClass());
            const sceneInstance = instance as BaseScene;
            if (typeof prop !== 'string') {
              throw new Error(
                `Scene method must be string: ${this.scopeName}.${sceneName}`,
              );
            }
            const fullName = `${this.scopeName}.${sceneName}.${prop}()`;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (!(prop in instance) || typeof instance[prop] !== 'function') {
              throw new Error(`Scene method ${prop} not found: ${fullName}`);
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const result = instance[prop].call(instance, ...args);
            if (isPromiseObject(result)) {
              throw new Error(
                `Scene method must not return a promise: ${fullName}`,
              );
            }
            const obj = result;

            const durationInfo = (() => {
              let duration = '';
              const lastDuration =
                (now.getTime() -
                  (sceneInstance.lastTimestamp ?? now.getTime())) /
                1000;
              const totalDuration =
                (now.getTime() - sceneInstance.timestamp) / 1000;
              if (lastDuration < 100) {
                duration += `+${lastDuration.toFixed(3)}s`;
              }
              if (totalDuration < 100) {
                duration += `(${totalDuration.toFixed(1)}s)`;
              }
              return { duration, totalDuration, lastDuration };
            })();
            const timestamp = () => {
              const ts = formatTime(now, {
                formatTemplate: 'HH:mm:ss.SSS',
              });
              return `${ts} ${durationInfo.duration}`;
            };

            sceneInstance.lastTimestamp = now.getTime();

            // runAfterInteraction
            void InteractionManager.runAfterInteractions(() => {
              setTimeout(() => {
                if (obj && obj instanceof Metadata) {
                  const rawMsg = stringifyFunc(...obj.args);
                  if (Array.isArray(obj.metadata)) {
                    for (let i = 0; i < obj.metadata.length; i += 1) {
                      const metadata = obj.metadata[i];
                      logFn({
                        timestamp,
                        durationInfo,
                        scopeName: this.scopeName,
                        sceneName,
                        metadata,
                        methodName: prop,
                        rawMsg,
                        obj,
                      });
                    }
                  } else {
                    logFn({
                      timestamp,
                      durationInfo,
                      scopeName: this.scopeName,
                      sceneName,
                      metadata: obj.metadata,
                      methodName: prop,
                      rawMsg,
                      obj,
                    });
                  }
                }
              });
            });
          } catch (error) {
            console.error(error);
          }
        },
    });
    return NOOP;
  }
}
