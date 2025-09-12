import type { ILaunchOptionsManagerInterface } from './type';

export default {
  getLaunchOptions: () => Promise.resolve(null),
  clearLaunchOptions: () => Promise.resolve(true),
} as ILaunchOptionsManagerInterface;
