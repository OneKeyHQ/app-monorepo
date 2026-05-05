export type IUtilsType = {
  consoleFunc: (msg: string) => void;
  getLogFilePath: (filename: string) => Promise<string>;
  getDeviceInfo: () => string;
  /** Flush any pending dedup repeat summary before log export. */
  flushPendingRepeat: () => void | Promise<void>;
};
