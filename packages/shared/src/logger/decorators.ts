import { InteractionManager } from 'react-native';
import { logger as RNLogger, consoleTransport } from 'react-native-logs';

import { isPromiseObject } from '../utils/promiseUtils';

import { stringifyFunc } from './stringifyFunc';
import { consoleFunc } from './utils';

// import type { IPrimitiveValue, IScene } from './types';

type ILogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ILoggerMethods = {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export type ILogger = ILoggerMethods & {
  extend: (extension: string) => ILoggerMethods;
};

export type IPrimitiveValue = string | number | boolean | null | undefined;

export enum ESceneName {
  wallet = 'wallet',
  common = 'common',
}

export interface IScene {
  getName: () => ESceneName;
}

const dangerLogger = RNLogger.createLogger<ILogLevel>({
  async: true,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  asyncFunc: InteractionManager.runAfterInteractions,
  dateFormat: 'iso',
  stringifyFunc,
  transport: [consoleTransport],
  transportOptions: {
    consoleFunc,
  },
});

const loggerExtensions: Record<
  string,
  ReturnType<typeof dangerLogger.extend>
> = {};

function getLoggerExtension(name: string) {
  if (!loggerExtensions[name]) {
    loggerExtensions[name] = dangerLogger.extend(name);
  }
  return loggerExtensions[name];
}

type ICreateLoggerMethodDecoratorArgs = {
  level: ILogLevel;
};

function createLocalLoggerDecorator(
  decoratorArgs: ICreateLoggerMethodDecoratorArgs,
) {
  return function logMethod(
    target: IScene,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: any[]) => any;
    descriptor.value = async function (...args: any[]) {
      const sceneName = target.getName();
      const loggerExtension = getLoggerExtension(sceneName);
      let result = originalMethod.apply(this, args);
      if (isPromiseObject(result)) {
        result = await result;
      }
      loggerExtension[decoratorArgs.level](`Method ${propertyKey}`, ...result);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    };
    return descriptor;
  };
}

function createServerLoggerDecorator(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decoratorArgs: ICreateLoggerMethodDecoratorArgs,
) {
  return function logMethod(
    target: IScene,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: any[]) => any;
    descriptor.value = async function (...args: any[]) {
      let result = originalMethod.apply(this, args);
      if (isPromiseObject(result)) {
        result = await result;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    };
  };
}

export function LogToLocal(decoratorArgs?: ICreateLoggerMethodDecoratorArgs) {
  return createLocalLoggerDecorator(decoratorArgs ?? { level: 'info' });
}

export function LogToServer(decoratorArgs?: ICreateLoggerMethodDecoratorArgs) {
  return createServerLoggerDecorator(decoratorArgs ?? { level: 'info' });
}
