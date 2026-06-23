import type { LOCAL_SECRET_ENVELOPE_INNER_PREFIX } from './consts';

export type ILocalSecretEnvelopeDataType = 'credential' | 'verify-string';

export type ILocalSecretEnvelopeLayerKind =
  | 'keychain'
  | 'keystore'
  | 'secure-storage'
  | 'indexeddb-cryptokey';

export type ILocalSecretEnvelopeLayerCapabilities = {
  sync: 'local-only' | 'cloud-sync' | 'unknown';
  extractable: boolean | 'unknown';
  keyAccess: 'opaque-decrypt' | 'raw-key-readable' | 'unknown';
  requireAuth?: boolean;
};

export type ILocalSecretEnvelopeLayer = {
  kind: ILocalSecretEnvelopeLayerKind;
  keyRef: string;
  alg: 'AES-256-GCM' | 'OS-Keychain' | 'OS-SecureStorage';
  iv?: string;
  capabilities: ILocalSecretEnvelopeLayerCapabilities;
};

export type ILocalSecretEnvelopeStrength =
  | 'secure-storage-bound'
  | 'device-bound'
  | 'profile-bound'
  | 'unavailable';

export type ILocalSecretEnvelopeV1 = {
  version: 1;
  dataType: ILocalSecretEnvelopeDataType;
  innerPrefix?: ILocalSecretEnvelopeInnerPrefix;
  recordId: string;
  wrappingLayers: ILocalSecretEnvelopeLayer[];
  strength: ILocalSecretEnvelopeStrength;
  protectedHeader: string;
  ciphertext: string;
};

export type ILocalSecretEnvelopeProtectedHeaderV1 = {
  version: 1;
  dataType: ILocalSecretEnvelopeDataType;
  innerPrefix?: ILocalSecretEnvelopeInnerPrefix;
  recordId: string;
  wrappingLayers: ILocalSecretEnvelopeLayer[];
};

export type ILocalSecretEnvelopeInnerPrefix =
  (typeof LOCAL_SECRET_ENVELOPE_INNER_PREFIX)[keyof typeof LOCAL_SECRET_ENVELOPE_INNER_PREFIX];

export type ILocalSecretEnvelopeLayerPrepareParams = {
  dataType: ILocalSecretEnvelopeDataType;
  layerIndex: number;
  recordId: string;
};

export type ILocalSecretEnvelopeLayerEncryptParams =
  ILocalSecretEnvelopeLayerPrepareParams & {
    aad: string;
    layer: ILocalSecretEnvelopeLayer;
    plaintext: string;
  };

export type ILocalSecretEnvelopeLayerDecryptParams =
  ILocalSecretEnvelopeLayerPrepareParams & {
    aad: string;
    ciphertext: string;
    layer: ILocalSecretEnvelopeLayer;
  };

export type ILocalSecretEnvelopeLayerDeleteKeyParams =
  ILocalSecretEnvelopeLayerPrepareParams & {
    layer: ILocalSecretEnvelopeLayer;
  };

export type ILocalSecretEnvelopeLayerAdapter = {
  kind: ILocalSecretEnvelopeLayerKind;
  prepareLayer: (
    params: ILocalSecretEnvelopeLayerPrepareParams,
  ) => Promise<ILocalSecretEnvelopeLayer>;
  encrypt: (params: ILocalSecretEnvelopeLayerEncryptParams) => Promise<string>;
  encryptWithExistingKey?: (
    params: ILocalSecretEnvelopeLayerEncryptParams,
  ) => Promise<string>;
  decrypt: (params: ILocalSecretEnvelopeLayerDecryptParams) => Promise<string>;
  deleteLayerKey?: (
    params: ILocalSecretEnvelopeLayerDeleteKeyParams,
  ) => Promise<void>;
};

export type ILocalSecretEnvelopeLayerAdapterResolver = (
  layer: ILocalSecretEnvelopeLayer,
) => ILocalSecretEnvelopeLayerAdapter | undefined;
