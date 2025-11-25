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
  approval = 'approval',
  account = 'account',
  cloudBackup = 'cloudBackup',
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
  wallet = 'wallet',
  ui = 'ui',
  referral = 'referral',
  reward = 'reward',
  dex = 'dex',
  perp = 'perp',
  prime = 'prime',
  cloudSync = 'cloudSync',
  ipTable = 'ipTable',
  networkDoctor = 'networkDoctor',
  onboarding = 'onboarding',
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

export type ILogBundle =
  | {
      type: 'text';
      fileName: string;
      mimeType: string;
      blob: Blob;
      content: string;
    }
  | {
      type: 'file';
      fileName: string;
      mimeType: string;
      filePath: string;
    };

export type ILogDigest = {
  sizeBytes: number;
  sha256: string;
  bundle: ILogBundle;
};

export type ILogUploadResponse = {
  objectKey: string;
  uploadedBytes: number;
  durationMs: number;
};

export enum ELogUploadStage {
  Collecting = 'collecting',
  Uploading = 'uploading',
  Success = 'success',
  Fallback = 'fallback',
  Error = 'error',
}
