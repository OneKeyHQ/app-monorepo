export type IUtilsType = {
  consoleFunc: (msg: string) => void;
  getLogFilePath: (filename: string) => Promise<string>;
  removeLogFilePath: (filePath: string) => Promise<void>;
  getDeviceInfo: () => string;
  /** Flush any pending dedup repeat summary before log export. */
  flushPendingRepeat: () => void | Promise<void>;
};
