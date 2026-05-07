export type IVaultClientErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'VAULT_CORRUPT'
  | 'VAULT_MISSING'
  | 'VAULT_WRITE_FAILED';

export class VaultClientError extends Error {
  constructor(
    readonly code: IVaultClientErrorCode,
    options?: { cause?: unknown },
  ) {
    super(
      code,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = 'VaultClientError';
  }
}
