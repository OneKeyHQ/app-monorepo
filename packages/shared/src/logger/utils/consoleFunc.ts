const logs: string[] = [];

export const consoleFunc = (msg: string) => {
  console.log(msg);
  logs.push(msg);
  // eslint-disable-next-line
  global.$backgroundApiProxy.serviceLogger.addMsg(`${msg}\r\n`);
};

export const getLogFilePaths = async () => [] as string[];
