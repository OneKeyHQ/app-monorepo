import { Suspense, lazy } from 'react';

import { KitProvider } from '@onekeyhq/kit';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import '@onekeyhq/shared/src/web/index.css';

function getAgentationEndpoint() {
  if (
    process.env.NODE_ENV === 'production' ||
    typeof globalThis === 'undefined' ||
    typeof globalThis.location === 'undefined'
  ) {
    return '';
  }

  try {
    const urlEndpoint = new URLSearchParams(globalThis.location.search).get(
      'agentationEndpoint',
    );
    return (
      urlEndpoint ||
      globalThis.localStorage?.getItem('ONEKEY_AGENTATION_ENDPOINT') ||
      ''
    );
  } catch {
    return '';
  }
}

const agentationEndpoint = getAgentationEndpoint();

// cspell:ignore Agentation
const AgentationDev =
  process.env.NODE_ENV !== 'production' && agentationEndpoint
    ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : () => null;

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return (
    <>
      <KitProvider {...props} />
      {process.env.NODE_ENV !== 'production' && agentationEndpoint ? (
        <Suspense>
          <AgentationDev endpoint={agentationEndpoint} />
        </Suspense>
      ) : null}
    </>
  );
}
