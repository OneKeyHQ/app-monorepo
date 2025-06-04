// Shared utility function to get OneKey ID user email
export const getOneKeyIdUserEmail = async (): Promise<string | undefined> => {
  try {
    // Dynamically import backgroundApiProxy to avoid circular dependencies
    const { default: backgroundApiProxy } = await import(
      '@onekeyhq/kit/src/background/instance/backgroundApiProxy'
    );

    // Check if user is logged in to OneKey ID
    const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();

    if (isLoggedIn) {
      // Get user info if logged in
      const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();
      return userInfo.displayEmail || userInfo.email;
    }
  } catch (error) {
    // If there's an error accessing the API, continue without user email
    console.warn('Failed to get OneKey ID user info for Intercom:', error);
  }

  return undefined;
};
