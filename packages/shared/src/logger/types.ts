export type ILoggerMethods = {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export type ILogger = ILoggerMethods & {
  extend: (extension: string) => ILoggerMethods;
};

export type ILogLevel = 'debug' | 'info' | 'warn' | 'error';

export enum EScopeName {
  app = 'app',
  demo = 'demo',
  setting = 'setting',
  addressInput = 'addressInput',
}
export interface IScope {
  getName: () => EScopeName;
}

export type IMethodDecoratorMetadata = {
  level: ILogLevel;
  type?: 'local' | 'server' | 'console';
};

export class Metadata {
  args: any;

  metadata: IMethodDecoratorMetadata;

  constructor(args: any, metadata: IMethodDecoratorMetadata) {
    this.args = args;
    this.metadata = metadata;
  }
}
export interface IScene {
  getName: () => string;
}
