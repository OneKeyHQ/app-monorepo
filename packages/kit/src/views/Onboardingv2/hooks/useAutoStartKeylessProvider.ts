import { useEffect, useRef } from 'react';

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

export function useAutoStartKeylessProvider({
  autoStartProvider,
  autoStartTriggerKey,
  enabled = true,
  onGoogleLogin,
  onAppleLogin,
}: {
  autoStartProvider?: EOAuthSocialLoginProvider;
  autoStartTriggerKey?: string;
  enabled?: boolean;
  onGoogleLogin: () => Promise<void> | void;
  onAppleLogin: () => Promise<void> | void;
}) {
  const autoTriggeredKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const autoStartKey = autoStartProvider
      ? `${autoStartProvider}:${autoStartTriggerKey ?? ''}`
      : undefined;

    if (
      !enabled ||
      !autoStartProvider ||
      autoTriggeredKeyRef.current === autoStartKey
    ) {
      return;
    }

    autoTriggeredKeyRef.current = autoStartKey;

    if (autoStartProvider === EOAuthSocialLoginProvider.Google) {
      void onGoogleLogin();
      return;
    }

    if (autoStartProvider === EOAuthSocialLoginProvider.Apple) {
      void onAppleLogin();
    }
  }, [
    autoStartProvider,
    autoStartTriggerKey,
    enabled,
    onAppleLogin,
    onGoogleLogin,
  ]);
}
