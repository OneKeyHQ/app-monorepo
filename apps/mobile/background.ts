import * as ExpoDevice from 'expo-device';
import * as Sharing from 'expo-sharing';
import { NativeModules } from 'react-native';
import { FileLogger } from 'react-native-file-logger';
import { createMMKV } from 'react-native-mmkv';

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
