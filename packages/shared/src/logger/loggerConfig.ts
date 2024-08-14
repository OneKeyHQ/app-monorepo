import { debounce, merge } from 'lodash';
import natsort from 'natsort';

import appStorage from '../storage/appStorage';

import type { BaseScene } from './base/baseScene';
import type { BaseScope } from './base/baseScope';

export type ILoggerConfig = {
  [scope: string]: {
    [scene: string]: boolean;
  };
};
function buildLoggerConfig(): ILoggerConfig {
  const config: ILoggerConfig = {};
  const defaultLoggerInstance =
    (global.$$defaultLogger as unknown as Record<string, BaseScope>) || {};
  Object.keys(defaultLoggerInstance)
    .sort((a, b) => natsort({ insensitive: true })(a, b))
    .forEach((scope) => {
      config[scope] = config[scope] || {};
      Object.keys(
        (defaultLoggerInstance as unknown as Record<string, BaseScope>)[
          scope
        ] || {},
      )
        .sort((a, b) => natsort({ insensitive: true })(a, b))
        .forEach((scene) => {
          if (defaultLoggerInstance[scope]) {
            const sceneInstance = (
              defaultLoggerInstance[scope] as unknown as Record<
                string,
                BaseScene
              >
            )[scene];
            try {
              //   const isProxy =
              //     Object.getPrototypeOf(sceneInstance) === Proxy.prototype;
              //   const isScene = sceneInstance instanceof BaseScene;
              const isSceneLike = !!sceneInstance.mockBaseSceneMethod;
              if (isSceneLike) {
                config[scope][scene] = false;
              }
            } catch (error) {
              //
            }
          }
        });
    });
  return config;
}

let savedLoggerConfig: ILoggerConfig | undefined;

const storageKey = '$$OneKeyV5LoggerConfig';
async function getSavedLoggerConfig() {
  if (savedLoggerConfig) {
    return savedLoggerConfig;
  }
  const config = await appStorage.getItem(storageKey);
  savedLoggerConfig = config
    ? merge(buildLoggerConfig(), (JSON.parse(config) as ILoggerConfig) || {})
    : buildLoggerConfig();
  return savedLoggerConfig;
}

const saveLoggerConfig = debounce(async (config: ILoggerConfig) => {
  await appStorage.setItem(storageKey, JSON.stringify(config));
}, 300);

// eslint-disable-next-line no-async-promise-executor
const savedLoggerConfigAsync = new Promise<ILoggerConfig>(async (resolve) => {
  const config = await getSavedLoggerConfig();
  resolve(config);
});

const defaultLoggerConfig = {
  buildLoggerConfig,
  getSavedLoggerConfig,
  saveLoggerConfig,
  savedLoggerConfigAsync,
};
export { defaultLoggerConfig };
