import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IExpoCameraModule = typeof import('expo-camera');

// TODO scan qrcode from base64 string
//    https://gist.github.com/aibrahim3546/7a3c7405c0a090889774ee29b1d87db7
export async function scanFromURLAsync(url: string) {
  try {
    if (platformEnv.isNativeIOSMacCatalyst) {
      return null;
    }
    const { Camera } = require('expo-camera') as IExpoCameraModule;
    const [result] = await Camera.scanFromURLAsync(url);
    return result.data;
  } catch (e) {
    console.error(`scanFromURLAsync(${url}) error: `, e);
    return null;
  }
}
