import { fileAsyncTransport, logger } from 'react-native-logs';

import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

const fileName = `metrix.log`;
const folderPath = RNFS?.TemporaryDirectoryPath || '';
const metrixLogFilePath = `${folderPath}${fileName}`;

export const resetLogFile = async () => {
  if (await RNFS?.exists(metrixLogFilePath)) {
    await RNFS?.unlink(metrixLogFilePath);
  }
  await RNFS?.writeFile(metrixLogFilePath, '');
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

export const uploadMetricsLogFile = (
  uploadUrl: string,
  unitTestName: string,
  password: string,
) =>
  RNFS?.uploadFiles({
    toUrl: uploadUrl,
    files: [
      {
        name: 'metrix',
        filename: fileName,
        filepath: metrixLogFilePath,
        filetype: 'text/plain',
      },
    ],
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    fields: {
      unitTestName,
      password,
    },
  }).promise;
