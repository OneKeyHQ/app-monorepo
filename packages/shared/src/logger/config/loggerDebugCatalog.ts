import { merge } from 'lodash';
import natsort from 'natsort';

import appGlobals from '../../appGlobals';
import { getLoggerScopeKeys } from '../loggerRegistry';

import { createDefaultLoggerConfig } from './loggerConfigShared';

import type { ILoggerConfig } from './loggerConfigShared';
import type { BaseScene } from '../base/baseScene';
import type { BaseScope } from '../base/baseScope';

export class LoggerDebugCatalog {
  buildConfig(): ILoggerConfig {
    const config = createDefaultLoggerConfig({ colorfulLog: true });
    const defaultLoggerInstance =
      (appGlobals.$defaultLogger as unknown as Record<string, BaseScope>) || {};

    // Hoist comparator once — natsort() allocates internally each call
    const compare = natsort({ insensitive: true });

    getLoggerScopeKeys()
      .toSorted(compare)
      .forEach((scope) => {
        config.enabled[scope] = config.enabled[scope] || {};

        // Resolve lazy getter once per scope, reuse for all scenes
        const scopeInstance = defaultLoggerInstance[scope];
        if (!scopeInstance) {
          return;
        }

        Object.keys(scopeInstance)
          .toSorted(compare)
          .forEach((scene) => {
            const sceneInstance = (
              scopeInstance as unknown as Record<string, BaseScene>
            )[scene];
            try {
              const isScene =
                sceneInstance && typeof sceneInstance._emitLog === 'function';
              if (isScene) {
                config.enabled[scope][scene] = false;
              }
            } catch (_error) {
              //
            }
          });
      });

    return config;
  }

  expandConfig(storedConfig?: ILoggerConfig): ILoggerConfig {
    return merge(this.buildConfig(), storedConfig || {});
  }
}
