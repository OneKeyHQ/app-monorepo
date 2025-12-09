import { NativeModules } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { FileLogger } from 'react-native-file-logger'

console.log('background.ts');
console.log('background222.ts');

globalThis._reactNativeModules = require('react-native');

globalThis.BackgroundRunnerModule = NativeModules.BackgroundRunnerModule;

globalThis.RootViewBackground = NativeModules.RootViewBackground;
console.log('createMMKV', createMMKV);
console.log('FileLogger', FileLogger);