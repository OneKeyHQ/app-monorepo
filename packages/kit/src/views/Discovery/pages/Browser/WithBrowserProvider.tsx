import { DiscoveryBrowserProviderMirror } from '../../components/DiscoveryBrowserProviderMirror';
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
