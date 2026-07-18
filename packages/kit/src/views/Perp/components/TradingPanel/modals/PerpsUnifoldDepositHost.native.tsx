// cspell: words unifold Unifold
import { useEffect } from 'react';

import { UnifoldProvider, useUnifold } from '@unifold/connect-react-native';

import { useThemeName } from '@onekeyhq/components';
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

// Mounted inside the Perp page tree (see pages/Perp.tsx). Hosts the Unifold
// provider so the SDK's deposit sheet can render above the Perps screens.
export function PerpsUnifoldDepositHost() {
  const themeName = useThemeName();
  if (!UNIFOLD_PERPS_PUBLISHABLE_KEY) {
    return null;
  }
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
}
