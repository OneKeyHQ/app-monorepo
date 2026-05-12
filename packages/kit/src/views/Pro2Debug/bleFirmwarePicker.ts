import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export type IBleFirmwareFile = {
  name: string;
  size?: number;
  localPath: string;
};

type IPickBleFirmwareFileOptions = {
  defaultFileName: string;
};

export async function pickBleFirmwareFileFromDevice(
  _options: IPickBleFirmwareFileOptions,
): Promise<IBleFirmwareFile | undefined> {
  throw new OneKeyLocalError('BLE firmware picker is only available on native');
}
