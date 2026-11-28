import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export type IPro2BleFirmwarePickedFile = {
  name: string;
  firmwareBase64: string;
};

function rejectNonNative<T>(): Promise<T> {
  return Promise.reject(
    new OneKeyLocalError(
      'Pro 2 Bluetooth firmware install is only available in the native app',
    ),
  );
}

export function loadPro2BleFirmwareBase64(
  _firmwareId: string,
  _title: string,
): Promise<string> {
  return rejectNonNative();
}

export function pickPro2BleFirmwareFile(): Promise<
  IPro2BleFirmwarePickedFile | undefined
> {
  return rejectNonNative();
}
