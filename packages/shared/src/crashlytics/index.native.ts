import platformEnv from '../platformEnv';

const getInstance = async () => {
  if (platformEnv.isProduction) {
    const Crashlytics = await import('@react-native-firebase/crashlytics');
    return Crashlytics.default?.();
  }
  return null;
};

export const setAttributes = async (params: Record<string, string>) => {
  const instance = await getInstance();
  if (!instance) return;
  return instance.setAttributes(params);
};
