export type IVaultRecord = {
  walletId: string;
  accessToken: string;
  ciphertextBase64: string;
  createdAt: number;
};

export type IVaultCacheEntry = {
  hdCredentialBlob: string;
  issuedAt: number;
  expiresAt: number;
};

export type IVaultSessionLabel = {
  displayAddress: string;
  sourceLabel: string;
};

export type IVaultMetadata = {
  activeWalletId: string | null;
  activeKeyId: string | null;
  schemaVersion: 1;
  vaultCreatedAt: number;
};

export type IVaultPlaintext = {
  schemaVersion: 1;
  records: Record<string, IVaultRecord>;
  cache: Record<string, IVaultCacheEntry>;
  metadata: IVaultMetadata;
  sessionLabels: Record<string, IVaultSessionLabel>;
};
