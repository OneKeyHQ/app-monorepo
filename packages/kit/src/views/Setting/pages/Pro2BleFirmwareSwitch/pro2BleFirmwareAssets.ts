import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export function loadPro2BleFirmwareBase64(
  _firmwareId: string,
  _title: string,
): Promise<string> {
  return Promise.reject(
    new OneKeyLocalError(
      'Pro 2 Bluetooth firmware install is only available in the native app',
    ),
  );
}
