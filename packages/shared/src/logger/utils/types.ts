export type IUtilsType = {
  consoleFunc: (msg: string) => void;
  getLogFilePath: (filename: string) => Promise<string>;
  getDeviceInfo: () => string;
  /** Flush any pending dedup repeat summary before log export. No-op on platforms with native dedup. */
  flushPendingRepeat?: () => void;
};
