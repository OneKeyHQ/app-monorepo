import type { ILocalSecretEnvelopeLayer } from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export const LSE_MMKV_RESTART_FIXTURE_KEY_REF =
  'onekey_lse_e2e_mmkv_restart_fixture_v1';
export const LSE_MMKV_RESTART_PROFILE_KEY_REF =
  'onekey_lse_e2e_mmkv_restart_profile_key_v1';
export const LSE_MMKV_RESTART_RECORD_ID = 'lse-native-mmkv-restart-record';
export const LSE_MMKV_RESTART_AAD = 'lse-native-mmkv-restart-aad';
export const LSE_MMKV_RESTART_PLAINTEXT = 'native-mmkv-restart-secret';

export type ILseMmkvRestartFixture = {
  ciphertext: string;
  layer: ILocalSecretEnvelopeLayer;
};

export function parseLseMmkvRestartFixture(
  value: string,
): ILseMmkvRestartFixture {
  const parsed = JSON.parse(value) as Partial<ILseMmkvRestartFixture>;
  if (
    typeof parsed.ciphertext !== 'string' ||
    !parsed.layer ||
    parsed.layer.kind !== 'mmkv-profile-key'
  ) {
    throw new OneKeyLocalError('Invalid native MMKV restart test fixture');
  }
  return parsed as ILseMmkvRestartFixture;
}
