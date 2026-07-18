// cspell: words unifold Unifold
import { Suspense, lazy, useEffect, useState } from 'react';

// Global mount for the Unifold provider host. It must live OUTSIDE any
// navigator screen: screens get frozen by react-freeze when covered (e.g. the
// Perps portfolio modal), which would swallow the SDK sheet's state updates
// and silently prevent the deposit modal from presenting.
//
// Lazily mounted after a short idle delay so the Unifold RN SDK module cost
// stays out of the cold-start path. On web/desktop/ext this resolves to the
// no-op host and renders nothing.
const LazyPerpsUnifoldDepositHost = lazy(() =>
  import(
    '@onekeyhq/kit/src/views/Perp/components/TradingPanel/modals/PerpsUnifoldDepositHost'
  ).then((module) => ({ default: module.PerpsUnifoldDepositHost })),
);

const HOST_MOUNT_DELAY_MS = 3000;

export function PerpsUnifoldDepositHostContainer() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), HOST_MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!ready) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyPerpsUnifoldDepositHost />
    </Suspense>
  );
}
