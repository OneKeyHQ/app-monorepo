import platformEnv from '../platformEnv';

const getInstance = async () => {
  if (
    platformEnv.isNative &&
    platformEnv.isProduction &&
    process.env.BUILD_NUMBER !== '1'
  ) {
    const Crashlytics = await import('@react-native-firebase/crashlytics');
    return Crashlytics.default?.();
  }
  return null;
};

export const setAttributes = async (params: { [key: string]: string }) => {
  const instance = await getInstance();
  if (!instance) return;
  return instance.setAttributes(params);
};

export const log = async (message: string) => {
  const instance = await getInstance();
  if (!instance) return;
  return instance.log(message);
};
