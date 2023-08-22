import { fileAsyncTransport, logger } from 'react-native-logs';

import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import { zip } from '@onekeyhq/shared/src/modules3rdParty/react-native-zip-archive';

const fileName = `metrix.log`;
const folderPath = `${RNFS?.TemporaryDirectoryPath || ''}metrix`;
const metrixLogFilePath = `${folderPath}/${fileName}`;
const zipName = 'metrix.zip';
const zipFolderPath = `${RNFS?.TemporaryDirectoryPath || ''}metrix_zip`;
const zipMetrixLogFilePath = `${zipFolderPath}/${zipName}`;

export const resetLogFile = async () => {
  if (RNFS) {
    if (await RNFS.exists(folderPath)) {
      await RNFS.unlink(folderPath);
    }
    await RNFS.mkdir(folderPath);
    await RNFS.mkdir(zipFolderPath);
    await RNFS.writeFile(metrixLogFilePath, '');
  }
};

export const metrixLogger = logger.createLogger({
  transport: fileAsyncTransport,
  dateFormat: 'iso',
  transportOptions: {
    async: true,
    FS: RNFS,
    filePath: folderPath,
    fileName,
  },
});

export const uploadMetricsLogFile = async (
  uploadUrl: string,
  unitTestName: string,
  password: string,
  extra: string,
) => {
  await zip(folderPath, zipMetrixLogFilePath);
  if (!(await RNFS?.exists(zipMetrixLogFilePath))) {
    throw new Error('zip log path is not exist');
  }
  return RNFS?.uploadFiles({
    toUrl: uploadUrl,
    files: [
      {
        name: 'metrix',
        filename: zipName,
        filepath: zipMetrixLogFilePath,
        filetype: 'application/zip',
      },
    ],
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    fields: {
      unitTestName,
      password,
      extra,
    },
  }).promise;
};
