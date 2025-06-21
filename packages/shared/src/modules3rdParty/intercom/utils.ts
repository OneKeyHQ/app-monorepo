import appGlobals from '../../appGlobals';
import stringUtils from '../../utils/stringUtils';

// Shared utility function to get OneKey ID user email
export const getOneKeyIdUserEmail = async (): Promise<string | undefined> => {
  try {
    // Use appGlobals to access backgroundApiProxy instead of direct import
    const backgroundApiProxy = appGlobals.$backgroundApiProxy;

    if (!backgroundApiProxy) {
      console.warn('backgroundApiProxy not available for Intercom user info');
      return undefined;
    }

    // Check if user is logged in to OneKey ID
    const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();

    if (isLoggedIn) {
      // Get user info if logged in
      const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();

      // Validate email format before returning
      if (userInfo.email && stringUtils.isValidEmail(userInfo.email)) {
        return userInfo.email;
      }

      return undefined;
    }
  } catch (error) {
    // If there's an error accessing the API, continue without user email
    console.warn('Failed to get OneKey ID user info for Intercom:', error);
  }

  return undefined;
};

// Shared utility function to build support URL with user email
export const buildSupportUrl = async (): Promise<string> => {
  const supportUrl = 'https://intercom-test-beryl.vercel.app/';

  return supportUrl;
};
