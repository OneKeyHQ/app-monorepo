import { buildLocalSecretEnvelopeAesGcmLayerAdapter } from './aesGcmLayerAdapter';
import mmkvProfileKeyStorage from './mmkvProfileKeyStorage';

import type { ILocalSecretEnvelopeAesGcmKeyStorage } from './aesGcmLayerAdapter';
import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerCapabilities,
} from './types';

export const DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF =
  'onekey_lse_mmkv_profile_key_v1';

const MMKV_PROFILE_KEY_LSE_LAYER_KIND = 'mmkv-profile-key';

const capabilities: ILocalSecretEnvelopeLayerCapabilities = {
  sync: 'local-only',
  extractable: true,
  keyAccess: 'raw-key-readable',
};

export type ILocalSecretEnvelopeMmkvProfileKeyStorage =
  ILocalSecretEnvelopeAesGcmKeyStorage & {
    removeItem: (keyRef: string) => Promise<void>;
  };

type IBuildMmkvProfileKeyLocalSecretEnvelopeLayerAdapterParams = {
  keyRef?: string;
  keyStorage?: ILocalSecretEnvelopeMmkvProfileKeyStorage;
  randomBytes?: (length: number) => Uint8Array;
};

export function buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
  keyRef = DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF,
  keyStorage = mmkvProfileKeyStorage,
  randomBytes,
}: IBuildMmkvProfileKeyLocalSecretEnvelopeLayerAdapterParams = {}): ILocalSecretEnvelopeLayerAdapter {
  return buildLocalSecretEnvelopeAesGcmLayerAdapter({
    capabilities,
    keyRef,
    keyStorage,
    kind: MMKV_PROFILE_KEY_LSE_LAYER_KIND,
    randomBytes,
  });
}

export async function isMmkvProfileKeyLocalSecretEnvelopeLayerAvailable({
  keyStorage = mmkvProfileKeyStorage,
}: {
  keyStorage?: ILocalSecretEnvelopeMmkvProfileKeyStorage;
} = {}): Promise<boolean> {
  try {
    return (await keyStorage.supportStorage?.()) ?? true;
  } catch {
    return false;
  }
}

export async function deleteMmkvProfileKeyForLocalSecretEnvelope({
  keyRef = DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF,
  keyStorage = mmkvProfileKeyStorage,
}: {
  keyRef?: string;
  keyStorage?: ILocalSecretEnvelopeMmkvProfileKeyStorage;
} = {}): Promise<void> {
  await keyStorage.removeItem(keyRef);
}
