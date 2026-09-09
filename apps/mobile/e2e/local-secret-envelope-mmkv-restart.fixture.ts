import mmkvProfileKeyStorage from '@onekeyhq/kit-bg/src/dbs/local/localSecretEnvelope/mmkvProfileKeyStorage';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const LSE_MMKV_RESTART_FIXTURE_KEY = 'hl-agent-envelope-v1';

export const LSE_MMKV_RESTART_PROFILE_KEY_REF =
  'onekey_lse_e2e_mmkv_restart_profile_key_v1';
export const LSE_MMKV_RESTART_SECURE_STORAGE_KEY_REF =
  'onekey_lse_e2e_hl_restart_secure_storage_v1';
export const LSE_MMKV_RESTART_USER_ADDRESS =
  '0x0000000000000000000000000000000000000e2e';

export type ILseMmkvRestartFixture = {
  agentAddress: string;
  envelope: string;
  recordId: string;
};

export async function getLseMmkvRestartFixture(): Promise<string | undefined> {
  return (
    (await mmkvProfileKeyStorage.getItem(LSE_MMKV_RESTART_FIXTURE_KEY)) ??
    undefined
  );
}

export async function removeLseMmkvRestartFixture(): Promise<void> {
  await mmkvProfileKeyStorage.removeItem(LSE_MMKV_RESTART_FIXTURE_KEY);
}

export async function setLseMmkvRestartFixture(value: string): Promise<void> {
  await mmkvProfileKeyStorage.setItem(LSE_MMKV_RESTART_FIXTURE_KEY, value);
}

export function parseLseMmkvRestartFixture(
  value: string,
): ILseMmkvRestartFixture {
  const parsed = JSON.parse(value) as Partial<ILseMmkvRestartFixture>;
  if (
    typeof parsed.agentAddress !== 'string' ||
    typeof parsed.envelope !== 'string' ||
    typeof parsed.recordId !== 'string'
  ) {
    throw new OneKeyLocalError('Invalid native HL Agent restart test fixture');
  }
  return parsed as ILseMmkvRestartFixture;
}
