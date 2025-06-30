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
