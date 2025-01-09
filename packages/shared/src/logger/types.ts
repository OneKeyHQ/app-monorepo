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
  notification = 'notification',
  app = 'app',
  account = 'account',
  demo = 'demo',
  setting = 'setting',
  addressInput = 'addressInput',
  signatureRecord = 'signatureRecord',
  discovery = 'discovery',
  token = 'token',
  swap = 'swap',
  transaction = 'transaction',
  hardware = 'hardware',
  fiatCrypto = 'fiatCrypto',
  accountSelector = 'accountSelector',
  scanQrCode = 'scanQrCode',
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

  metadata: IMethodDecoratorMetadata | IMethodDecoratorMetadata[];

  constructor(
    args: any,
    metadata: IMethodDecoratorMetadata | IMethodDecoratorMetadata[],
  ) {
    this.args = args;
    this.metadata = metadata;
  }
}
export interface IScene {
  getName: () => string;
}
export const NO_LOG_OUTPUT = '$$_NO_LOG_OUTPUT_8888888';
