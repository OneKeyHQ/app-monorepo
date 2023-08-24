import { fileAsyncTransport, logger } from 'react-native-logs';

import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import { zip } from '@onekeyhq/shared/src/modules3rdParty/react-native-zip-archive';

const fileName = `metrix.log`;
const folderPath = `${RNFS?.TemporaryDirectoryPath || ''}metrix`;
const zipName = 'metrix.zip';
const zipFolderPath = `${RNFS?.TemporaryDirectoryPath || ''}metrix_zip`;
const zipMetrixLogFilePath = `${zipFolderPath}/${zipName}`;

export const initLogFolder = async () => {
  if (RNFS) {
    await RNFS.mkdir(folderPath);
    await RNFS.mkdir(zipFolderPath);
  }
};

const clearLogFolder = async () => {
  if (RNFS) {
    await RNFS.unlink(folderPath);
    await RNFS.unlink(zipFolderPath);
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
  if (!(await RNFS?.exists(folderPath))) {
    throw new Error('metrics log is not exist');
  }
  await zip(folderPath, zipMetrixLogFilePath);
  if (!(await RNFS?.exists(zipMetrixLogFilePath))) {
    throw new Error('zip log path is not exist');
  }
  const response = await RNFS?.uploadFiles({
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
  let result = { success: false, message: '' };
  try {
    result = JSON.parse(response?.body || '');
    if (result.success) {
      await clearLogFolder();
    }
  } catch (e) {
    console.log(e);
  }
  return result;
};
