import type { ILaunchOptionsManagerInterface } from './type';

export default {
  getLaunchOptions: () => Promise.resolve(null),
  clearLaunchOptions: () => Promise.resolve(true),
  getDeviceToken: () => Promise.resolve(null),
} as ILaunchOptionsManagerInterface;
