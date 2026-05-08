import type { IVaultPlaintext } from './types';

export type IVaultInvariantClass = 'A' | 'B' | 'C' | 'D';

export class VaultError extends Error {
  constructor(
    readonly code: 'VAULT_CORRUPT',
    readonly details: { class: IVaultInvariantClass },
  ) {
    super(code);
    this.name = 'VaultError';
  }
}

function throwVaultCorrupt(invariantClass: IVaultInvariantClass): never {
  throw new VaultError('VAULT_CORRUPT', { class: invariantClass });
}

function getCacheKeyId(cacheKey: string): string {
  const separatorIndex = cacheKey.lastIndexOf(':');
  return separatorIndex >= 0 ? cacheKey.slice(separatorIndex + 1) : cacheKey;
}

export function assertVaultInvariants(vault: IVaultPlaintext): void {
  const recordKeys = Object.keys(vault.records);
  const recordKeySet = new Set(recordKeys);

  if (recordKeys.length > 1) {
    throwVaultCorrupt('A');
  }

  const { activeKeyId } = vault.metadata;
  if (activeKeyId !== null && !recordKeySet.has(activeKeyId)) {
    throwVaultCorrupt('B');
  }

  if (recordKeys.length === 1 && activeKeyId !== recordKeys[0]) {
    throwVaultCorrupt('B');
  }

  for (const keyId of Object.keys(vault.sessionLabels)) {
    if (!recordKeySet.has(keyId)) {
      throwVaultCorrupt('C');
    }
  }

  for (const cacheKey of Object.keys(vault.cache)) {
    if (!recordKeySet.has(getCacheKeyId(cacheKey))) {
      throwVaultCorrupt('D');
    }
  }
}
