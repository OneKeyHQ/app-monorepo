import type {
  getTimeSinceStartup,
  onUpdate,
  start,
  stop,
} from 'react-native-metrix';

export type { metrixUpdateInfo } from 'react-native-metrix';

export type IGetTimeSinceStartupFunc = typeof getTimeSinceStartup;
export type IOnUpdateFunc = typeof onUpdate;
export type IStartFunc = typeof start;
export type IStopFunc = typeof stop;
