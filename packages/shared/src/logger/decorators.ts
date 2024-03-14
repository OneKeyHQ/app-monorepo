import { InteractionManager } from 'react-native';
import { logger as RNLogger, consoleTransport } from 'react-native-logs';

import { isPromiseObject } from '../utils/promiseUtils';

import { stringifyFunc } from './stringifyFunc';
import { consoleFunc } from './utils/consoleFunc';

import type { IPrimitiveValue, IScene } from './types';

type ILogLevel = 'debug' | 'info' | 'warn' | 'error';

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

export class LogMsg {
  data: any[];

  constructor(data: any[]) {
    this.data = data;
  }

  static Primitive(...data: IPrimitiveValue[]) {
    return new LogMsg(data);
  }

  static Any(...data: any[]) {
    return new LogMsg(data);
  }
}

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
      if (result instanceof LogMsg) {
        loggerExtension[decoratorArgs.level](
          `Method ${propertyKey}()`,
          ...result.data,
        );
      }
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
      if (result instanceof LogMsg) {
        // TODO: implement server logging, mix panel, etc.
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
