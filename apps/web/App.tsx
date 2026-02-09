import { lazy, Suspense } from 'react';

import { KitProvider } from '@onekeyhq/kit';
import '@onekeyhq/shared/src/web/index.css';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const AgentationDev =
  process.env.NODE_ENV !== 'production' && !platformEnv.isNative
    ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : () => null;

export default function App(props: any) {
  return (
    <>
      <KitProvider {...props} />
      {process.env.NODE_ENV !== 'production' && (
        <Suspense>
          <AgentationDev endpoint="http://localhost:4747" />
        </Suspense>
      )}
    </>
  );
}
