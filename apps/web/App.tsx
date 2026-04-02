import { Suspense, lazy } from 'react';

import { KitProvider } from '@onekeyhq/kit';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import '@onekeyhq/shared/src/web/index.css';

// cspell:ignore Agentation
const AgentationDev =
  process.env.NODE_ENV !== 'production'
    ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : () => null;

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return (
    <>
      <KitProvider {...props} />
      {process.env.NODE_ENV !== 'production' ? (
        <Suspense>
          <AgentationDev endpoint="http://localhost:4747" />
        </Suspense>
      ) : null}
    </>
  );
}
