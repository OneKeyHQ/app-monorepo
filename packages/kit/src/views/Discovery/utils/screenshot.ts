import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs/index.native';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SCREENSHOT_FOLDER } from '../config/Screenshot.constants';

export async function checkAndCreateFolder() {
  try {
    const folderExists = await RNFS.exists(SCREENSHOT_FOLDER);
    if (folderExists) {
      console.log('Folder already exists:', SCREENSHOT_FOLDER);
    } else {
      await RNFS.mkdir(SCREENSHOT_FOLDER);
      console.log('Folder created:', SCREENSHOT_FOLDER);
    }
  } catch (error) {
    console.log('Error checking and creating folder:', error);
  }
}

export function getScreenshotPath(filename: string) {
  if (platformEnv.isNativeAndroid) {
    return `file://${SCREENSHOT_FOLDER}/${filename}`;
  }
  return `${SCREENSHOT_FOLDER}/${filename}`;
}

export async function saveScreenshot(imageUri: string, savePath: string) {
  if (await RNFS.exists(savePath)) {
    console.log('file exists');
    await RNFS.unlink(savePath);
  }
  RNFS.moveFile(imageUri, savePath)
    .then((value) => {
      console.log('move file success: ', value);
    })
    .catch((e) => {
      console.log('move file error: ', e);
    });
}
