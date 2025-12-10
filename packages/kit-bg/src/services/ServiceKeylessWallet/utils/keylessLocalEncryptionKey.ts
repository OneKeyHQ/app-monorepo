import { decodeSensitiveTextAsync, sha256 } from '@onekeyhq/core/src/secret';

import { settingsPersistAtom } from '../../../states/jotai/atoms';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

/**
 * Build encryption key from sensitiveEncodeKey and session passcode.
 */
export async function buildKeylessLocalEncryptionKey(params: {
  backgroundApi: IBackgroundApi;
}): Promise<string> {
  const { backgroundApi } = params;

  // 1. Get sensitiveEncodeKey from settings
  const settings = await settingsPersistAtom.get();
  const sensitiveEncodeKey = settings.sensitiveEncodeKey;

  // 2. Get current session passcode
  const { password } =
    await backgroundApi.servicePassword.promptPasswordVerify();

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
