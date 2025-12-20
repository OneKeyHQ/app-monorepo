import appGlobals from '../../appGlobals';

export const getCustomerJWT = async (): Promise<string | undefined> => {
  try {
    // Use appGlobals to access backgroundApiProxy instead of direct import
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for customer JWT');
      return undefined;
    }

    // Check if user is logged in to OneKey ID
    const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();

    if (isLoggedIn) {
      // Get customer JWT if logged in
      const response =
        await backgroundApiProxy.servicePrime.apiGetCustomerJWT();

      return response?.token;
    }
  } catch (error) {
    console.warn('Failed to get customer JWT for Intercom:', error);
  }

  return undefined;
};

export const getInstanceId = async (): Promise<string | undefined> => {
  try {
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for instance ID');
      return undefined;
    }

    return await backgroundApiProxy.serviceSetting.getInstanceId();
  } catch (error) {
    console.warn('Failed to get instance ID for Intercom:', error);
  }

  return undefined;
};

export const buildIntercomUrl = (
  baseUrl: string,
  params?: {
    token?: string;
    instanceId?: string;
    requestId?: string;
  },
): string => {
  let url = baseUrl;

  // Add token if provided
  if (params?.token) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}intercom_user_jwt=${encodeURIComponent(params.token)}`;
  }

  // Add instanceId if provided
  if (params?.instanceId) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}instanceId=${encodeURIComponent(params.instanceId)}`;
  }

  // Add requestId if provided
  if (params?.requestId) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}requestId=${encodeURIComponent(params.requestId)}`;
  }

  return url;
};
