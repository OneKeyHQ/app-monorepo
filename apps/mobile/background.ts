import * as ExpoDevice from 'expo-device';
import * as Sharing from 'expo-sharing';
import { NativeModules } from 'react-native';
import { FileLogger } from 'react-native-file-logger';
import { createMMKV } from 'react-native-mmkv';

import { nativeBGBridge } from '@onekeyhq/shared/src/nativeBridge';

console.log('background.ts');
console.log('background22212.ts');

globalThis._reactNativeModules = require('react-native');

globalThis.BackgroundRunnerModule = NativeModules.BackgroundRunnerModule;

globalThis.RootViewBackground = NativeModules.RootViewBackground;
console.log('createMMKV', createMMKV);
console.log('FileLogger', FileLogger);
console.log('ExpoDevice', ExpoDevice);

globalThis.Sharing = async () => {
  return Sharing.shareAsync('12313213');
};

nativeBGBridge.postHostMessage({ type: 'test' });

nativeBGBridge.onHostMessage((message) => {
  console.log('message', message);
  if (message.type === 'test1') {
    setTimeout(() => {
      nativeBGBridge.postHostMessage({ type: 'test2' });
    }, 3000);
  }
});
