// cspell: words unifold Unifold
import { memo, useEffect } from 'react';

import { UnifoldProvider, useUnifold } from '@unifold/connect-react-native';

import { Portal, useThemeName } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { UNIFOLD_PERPS_PUBLISHABLE_KEY } from '../../../consts/unifold';

import {
  getNativeUnifoldBeginDeposit,
  setNativeUnifoldBeginDeposit,
} from './unifoldNativeBridge';

// Captures the provider-scoped beginDeposit into the platform-neutral bridge
// so imperative launchers (PerpsUnifoldDepositModal.native.tsx) can reach it.
function UnifoldNativeBridge() {
  const { beginDeposit } = useUnifold();
  useEffect(() => {
    setNativeUnifoldBeginDeposit(beginDeposit);
    return () => {
      if (getNativeUnifoldBeginDeposit() === beginDeposit) {
        setNativeUnifoldBeginDeposit(undefined);
      }
    };
  }, [beginDeposit]);
  return null;
}

const PerpsUnifoldDepositProvider = memo(
  function PerpsUnifoldDepositProvider() {
    const themeName = useThemeName();
    return (
      <UnifoldProvider
        publishableKey={UNIFOLD_PERPS_PUBLISHABLE_KEY}
        config={{
          appearance: themeName === 'dark' ? 'dark' : 'light',
          enableTransferCrypto: true,
          enableFiatOnramp: true,
          // Cash App is web + iOS only per Unifold platform matrix.
          enableCashApp: !platformEnv.isNativeAndroid,
          // Stripe Link stays off until the Apple Pay merchant entitlement work
          // lands; keeping it off also avoids requiring native onramp setup.
          enableStripeLink: false,
        }}
      >
        <UnifoldNativeBridge />
      </UnifoldProvider>
    );
  },
);

// The SDK sheet is patched to render inline instead of creating a second
// native Modal surface. Mount the provider in OneKey's full-window portal so
// its backdrop blocks the entire app and cannot pass touches through.
export function PerpsUnifoldDepositHost() {
  if (!UNIFOLD_PERPS_PUBLISHABLE_KEY) {
    return null;
  }
  return (
    <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
      <PerpsUnifoldDepositProvider />
    </Portal.Body>
  );
}
