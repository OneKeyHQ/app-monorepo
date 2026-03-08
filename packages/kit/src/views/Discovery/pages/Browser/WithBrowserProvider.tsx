import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DiscoveryBrowserProviderMirror } from '../../components/DiscoveryBrowserProviderMirror';
import { useMemoryPressureHandler } from '../../hooks/useMemoryPressureHandler.desktop';
import { usePendingDiscoveryUrl } from '../../hooks/usePendingDiscoveryUrl';

/**
 * Internal component to handle pending Discovery URLs
 * Must be inside DiscoveryBrowserProviderMirror to access Discovery Context
 */
function PendingUrlHandler<T extends object>({
  Component,
  props,
}: {
  Component: React.ComponentType<T>;
  props: T;
}): JSX.Element {
  // Handle pending URL to open in Discovery browser
  usePendingDiscoveryUrl();

  // Handle memory pressure events (desktop only)
  if (platformEnv.isDesktop) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMemoryPressureHandler();
  }

  return <Component {...props} />;
}

export function withBrowserProvider<T extends object>(
  WrappedComponent: React.ComponentType<T>,
): React.ComponentType<T> {
  return function WithBrowserProvider(props: T): JSX.Element {
    return (
      <DiscoveryBrowserProviderMirror>
        <PendingUrlHandler Component={WrappedComponent} props={props} />
      </DiscoveryBrowserProviderMirror>
    );
  };
}
