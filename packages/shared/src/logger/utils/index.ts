import platformEnv from '../../platformEnv';

export const consoleFunc = (msg: string) => {
  console.log(msg);
  // eslint-disable-next-line
  global.$backgroundApiProxy.serviceLogger.addMsg(`${msg}\r\n`);
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getLogFilePath = async (filename: string) => {
  throw new Error('Not implemented');
};

export const getDeviceInfo = () => [
  `appPlatform: ${platformEnv.appPlatform ?? ''}`,
  `appChannel: ${platformEnv.appChannel ?? ''}`,
  `buildNumber: ${platformEnv.buildNumber ?? ''}`,
  `version: ${platformEnv.version ?? ''}`,
];
