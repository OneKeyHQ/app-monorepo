import appGlobals from '../appGlobals';

export const getInstanceId = async (): Promise<string | undefined> => {
  try {
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for instance ID');
      return undefined;
    }

    return await backgroundApiProxy.serviceSetting.getInstanceId();
  } catch (error) {
    console.warn('Failed to get instance ID:', error);
  }

  return undefined;
};
