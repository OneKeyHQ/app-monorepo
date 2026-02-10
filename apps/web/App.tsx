import { Suspense, lazy } from 'react';

import { KitProvider } from '@onekeyhq/kit';
import '@onekeyhq/shared/src/web/index.css';

// cspell:ignore Agentation
const AgentationDev =
  process.env.NODE_ENV !== 'production'
    ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : () => null;

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[LANDING_DEBUG] App render, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
    );
  }
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
