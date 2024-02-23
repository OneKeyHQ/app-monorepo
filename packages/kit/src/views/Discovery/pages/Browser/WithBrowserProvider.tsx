import { DiscoveryBrowserProviderMirror } from '../../components/DiscoveryBrowserProviderMirror';

export function withBrowserProvider<T extends React.PropsWithChildren>(
  WrappedComponent: React.ComponentType<T>,
): React.ComponentType<T> {
  return function WithBrowserProvider(props: T): JSX.Element {
    return (
      <DiscoveryBrowserProviderMirror>
        <WrappedComponent {...props} />
      </DiscoveryBrowserProviderMirror>
    );
  };
}
