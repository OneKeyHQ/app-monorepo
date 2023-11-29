import { ProviderJotaiContextDiscovery } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

export function withBrowserProvider<T extends React.PropsWithChildren>(
  WrappedComponent: React.ComponentType<T>,
): React.ComponentType<T> {
  return function WithBrowserProvider(props: T): JSX.Element {
    return (
      <ProviderJotaiContextDiscovery>
        <WrappedComponent {...props} />
      </ProviderJotaiContextDiscovery>
    );
  };
}
