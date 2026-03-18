import { useEffect, useRef } from 'react';

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

export function useAutoStartKeylessProvider({
  autoStartProvider,
  enabled = true,
  onGoogleLogin,
  onAppleLogin,
}: {
  autoStartProvider?: EOAuthSocialLoginProvider;
  enabled?: boolean;
  onGoogleLogin: () => Promise<void> | void;
  onAppleLogin: () => Promise<void> | void;
}) {
  const autoTriggeredProviderRef = useRef<
    EOAuthSocialLoginProvider | undefined
  >(undefined);

  useEffect(() => {
    if (
      !enabled ||
      !autoStartProvider ||
      autoTriggeredProviderRef.current === autoStartProvider
    ) {
      return;
    }

    autoTriggeredProviderRef.current = autoStartProvider;

    if (autoStartProvider === EOAuthSocialLoginProvider.Google) {
      void onGoogleLogin();
      return;
    }

    if (autoStartProvider === EOAuthSocialLoginProvider.Apple) {
      void onAppleLogin();
    }
  }, [autoStartProvider, enabled, onAppleLogin, onGoogleLogin]);
}
