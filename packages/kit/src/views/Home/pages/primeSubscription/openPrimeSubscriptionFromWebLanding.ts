type IOneKeyPrivateProvider = {
  request: (args: { method: string }) => Promise<unknown>;
};

export function getOneKeyPrivateProvider(): IOneKeyPrivateProvider | undefined {
  const privateProvider = (
    globalThis as {
      $onekey?: {
        $private?: {
          request?: (args: { method: string }) => Promise<unknown>;
        };
      };
    }
  ).$onekey?.$private;
  if (typeof privateProvider?.request !== 'function') {
    return undefined;
  }
  return {
    request: privateProvider.request.bind(privateProvider),
  };
}

export async function openPrimeSubscriptionFromWebLanding({
  getPrivateProvider = getOneKeyPrivateProvider,
  openViaDeepLink,
}: {
  getPrivateProvider?: () => IOneKeyPrivateProvider | undefined;
  openViaDeepLink: () => void;
}): Promise<'extension' | 'deeplink'> {
  const privateProvider = getPrivateProvider();
  if (privateProvider) {
    try {
      await privateProvider.request({
        method: 'wallet_openPrimeSubscription',
      });
      return 'extension';
    } catch {
      // Older extensions do not implement wallet_openPrimeSubscription.
    }
  }
  openViaDeepLink();
  return 'deeplink';
}
