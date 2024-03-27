export type IUtilsType = {
  consoleFunc: (msg: string) => void;
  getLogFilePath: (filename: string) => Promise<string>;
  getDeviceInfo: () => string;
};
