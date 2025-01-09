import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const withPromptPasswordVerify = async <T>({
  run,
  options,
}: {
  run: () => Promise<T>;
  options?: { timeout?: number };
}): Promise<T> => {
  try {
    await backgroundApiProxy.servicePassword.openPasswordSecuritySession(
      options,
    );
    const result = await run();
    // Do something with the result if needed
    return result;
  } finally {
    await backgroundApiProxy.servicePassword.closePasswordSecuritySession();
  }
};
