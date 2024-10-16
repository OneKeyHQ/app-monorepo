import { debounce, merge } from 'lodash';
import natsort from 'natsort';

import appStorage from '../storage/appStorage';

import type { BaseScene } from './base/baseScene';
import type { BaseScope } from './base/baseScope';

export type ILoggerConfig = {
  highlightDurationGt?: string;
  colorfulLog?: boolean;
  enabled: {
    [scope: string]: {
      [scene: string]: boolean;
    };
  };
};
function buildLoggerConfig(): ILoggerConfig {
  const config: ILoggerConfig = {
    highlightDurationGt: '100',
    colorfulLog: true,
    enabled: {},
  };
  const defaultLoggerInstance =
    (globalThis.$$defaultLogger as unknown as Record<string, BaseScope>) || {};
  Object.keys(defaultLoggerInstance)
    .sort((a, b) => natsort({ insensitive: true })(a, b))
    .forEach((scope) => {
      config.enabled[scope] = config.enabled[scope] || {};
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
                config.enabled[scope][scene] = false;
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

const saveLoggerConfig = debounce(
  async (config: ILoggerConfig) => {
    await appStorage.setItem(storageKey, JSON.stringify(config));
    if (savedLoggerConfig) {
      Object.assign(savedLoggerConfig, config);
    }
  },
  300,
  {
    leading: false,
    trailing: true,
  },
);

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
