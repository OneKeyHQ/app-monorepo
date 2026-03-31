export const NativeLogger = {
  write: (_level: number, _msg: string) => {},
  flushPendingRepeat: () => {},
  getLogDirectory: () => '',
  getLogFilePaths: () => Promise.resolve([] as string[]),
  deleteLogFiles: () => Promise.resolve(),
};

export const LogLevel = {
  Debug: 0,
  Info: 1,
  Warning: 2,
  Error: 3,
} as const;
