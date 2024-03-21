const logs: string[] = [];

export const consoleFunc = (msg: string) => {
  console.log(msg);
  logs.push(msg);
  // eslint-disable-next-line
  global.$backgroundApiProxy.serviceLogger.addMsg(`${msg}\r\n`);
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getLogFilePath = async (filename: string) => {
  throw new Error('Not implemented');
};

export const getDeviceInfo = () => '';
