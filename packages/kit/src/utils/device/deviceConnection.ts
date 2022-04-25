import OneKeyConnect from '@onekeyfe/js-sdk';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import bleHandler from './ble/handler';

const hasInitOneKeyConnect = false;

const CONNECT_URL = platformEnv.isDev
  ? 'https://connect.onekey.so/'
  : 'https://connect.onekey.so/';

const getConnectInstance = async (): Promise<typeof OneKeyConnect> => {
  // TODO: 需要 promise chain 确保 connect 完成之后再去进行下一步，否则这里需要 try catch
  // try {
  // if (hasInitOneKeyConnect) return OneKeyConnect;
  // const CONNECT_SRC = platformEnv.isDesktop ? '/static/js-sdk/' : CONNECT_URL;

  await OneKeyConnect.init({
    connectSrc: CONNECT_URL,
    transportReconnect: true,
    debug: false,
    popup: false,
    webusb: false,
    env: platformEnv.isNative ? 'react-native' : 'web',
    ble: platformEnv.isNative ? bleHandler : null,
    manifest: {
      email: 'hi@onekey.so',
      appUrl: 'https://onekey.so',
    },
  });
  // hasInitOneKeyConnect = true;
  return OneKeyConnect;
  // } catch (e) {
  //   // ignore error and retry
  //   return new Promise((resolve) =>
  //     setTimeout(() => resolve(getConnectInstance()), 1000),
  //   );
  // }
};

getConnectInstance();

export default getConnectInstance;
