import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

export type IBleFirmwareFile = {
  name: string;
  size?: number;
  localPath: string;
};

type IPickBleFirmwareFileOptions = {
  defaultFileName: string;
};

function getFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export async function pickBleFirmwareFileFromDevice({
  defaultFileName,
}: IPickBleFirmwareFileOptions): Promise<IBleFirmwareFile | undefined> {
  try {
    const [result] = await pick({
      type: [types.allFiles],
    });

    if (!result?.uri) {
      return undefined;
    }

    const fileName = result.name ?? defaultFileName;
    const [localCopyResult] = await keepLocalCopy({
      files: [{ uri: result.uri, fileName }],
      destination: 'cachesDirectory',
    });

    if (localCopyResult.status !== 'success') {
      throw new OneKeyLocalError(
        `Copy BLE firmware failed: ${localCopyResult.copyError}`,
      );
    }

    if (!RNFS) {
      throw new OneKeyLocalError('RNFS is not available');
    }

    const localPath = decodeURIComponent(
      localCopyResult.localUri.replace(/^file:\/\//, ''),
    );
    const stat = await RNFS.stat(localPath).catch(() => undefined);

    return {
      name: fileName,
      size: getFiniteNumber(result.size ?? stat?.size),
      localPath,
    };
  } catch (error) {
    if (
      isErrorWithCode(error) &&
      error.code === errorCodes.OPERATION_CANCELED
    ) {
      return undefined;
    }
    throw error;
  }
}
