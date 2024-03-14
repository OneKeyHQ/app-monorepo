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
