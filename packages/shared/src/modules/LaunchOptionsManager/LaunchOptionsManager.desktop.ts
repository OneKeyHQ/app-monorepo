import type { ILaunchOptionsManagerInterface } from './type';

export default () => {
  return {
    getLaunchOptions: () => Promise.resolve(null),
    clearLaunchOptions: () => Promise.resolve(true),
  } as ILaunchOptionsManagerInterface;
};
