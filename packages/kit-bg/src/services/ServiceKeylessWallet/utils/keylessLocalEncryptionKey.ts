import { decodeSensitiveTextAsync, sha256 } from '@onekeyhq/core/src/secret';

import { settingsPersistAtom } from '../../../states/jotai/atoms';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

/**
 * Build encryption key from sensitiveEncodeKey and a provided password (no prompt).
 * Used when updating password to re-encrypt keyless data with old/new password.
 */
export async function buildKeylessLocalEncryptionKeyWithPassword(params: {
  password: string; // encoded password
}): Promise<string> {
  const { password } = params;

  // 1. Get sensitiveEncodeKey from settings
  const settings = await settingsPersistAtom.get();
  const sensitiveEncodeKey = settings.sensitiveEncodeKey;

  // 2. Decode and hash the provided password
  const decodedPassword = await decodeSensitiveTextAsync({
    encodedText: password,
  });

  const hashedPassword = await sha256(
    Buffer.from(
      `${decodedPassword}BB662525-CC49-4A52-93A5-AD237AC80A1D`,
      'utf-8',
    ),
  );

  // 3. Combine sensitiveEncodeKey and passcode to form encryption key
  return `${sensitiveEncodeKey}--${hashedPassword.toString('hex')}`;
}

/**
 * Build encryption key from sensitiveEncodeKey and session passcode.
 * This requires passcode verification and is used for RefreshToken encryption.
 */
export async function buildKeylessLocalEncryptionKey(params: {
  backgroundApi: IBackgroundApi;
}): Promise<string> {
  const { backgroundApi } = params;

  // Get current session passcode
  const { password } =
    await backgroundApi.servicePassword.promptPasswordVerify();

  // Delegate to buildKeylessLocalEncryptionKeyWithPassword
  return buildKeylessLocalEncryptionKeyWithPassword({ password });
}

/**
 * Build encryption key from sensitiveEncodeKey only (no passcode required).
 * This is used for Token encryption which doesn't require passcode verification.
 */
export async function buildKeylessLocalEncryptionKeyWithoutPasscode(): Promise<string> {
  // Get sensitiveEncodeKey from settings
  const settings = await settingsPersistAtom.get();
  const sensitiveEncodeKey = settings.sensitiveEncodeKey;

  const hashedKey = await sha256(
    Buffer.from(
      `${sensitiveEncodeKey}C8F3E2A1-D4B5-46E7-9F0C-8A1B2C3D4E5F`,
      'utf-8',
    ),
  );

  return hashedKey.toString('hex');
}
