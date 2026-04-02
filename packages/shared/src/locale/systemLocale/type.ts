export type ISystemLocaleMethods = {
  getSystemLocale: () => string;
  initSystemLocale: () => Promise<void>;
};
