// // Replace by performance.reactNativeStartupTiming.initializeRuntimeStart;
// //  in React Native 0.73
// export {
//   getTimeSinceStartup,
//   onUpdate,
//   start,
//   stop,
// } from 'react-native-metrix';
import type {
  IGetTimeSinceStartupFunc,
  IOnUpdateFunc,
  IStartFunc,
  IStopFunc,
} from './type';

export const getTimeSinceStartup: IGetTimeSinceStartupFunc = () =>
  Date.now() - performance.timeOrigin;

export const onUpdate: IOnUpdateFunc = () => () => {};

export const start: IStartFunc = () => undefined;

export const stop: IStopFunc = () => undefined;
