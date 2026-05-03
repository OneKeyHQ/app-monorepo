import type { ICliErrorCode } from './codes';

type ICliErrorOptions = {
  message?: string;
  cause?: Error;
};

type ICliErrorConstructor = new (
  code: ICliErrorCode,
  options?: ICliErrorOptions,
) => CliError;

export class CliError extends Error {
  readonly code: ICliErrorCode;

  constructor(
    name: string,
    code: ICliErrorCode,
    options: ICliErrorOptions = {},
  ) {
    super(
      options.message ?? code,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = name;
    this.code = code;
  }
}

function createCliErrorConstructor(name: string): ICliErrorConstructor {
  function NamedCliError(
    this: CliError,
    code: ICliErrorCode,
    options?: ICliErrorOptions,
  ) {
    return new CliError(name, code, options);
  }
  return NamedCliError as unknown as ICliErrorConstructor;
}

export const VaultError = createCliErrorConstructor('VaultError');
export const ServiceError = createCliErrorConstructor('ServiceError');
export const LockError = createCliErrorConstructor('LockError');
