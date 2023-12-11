import { ProviderJotaiContextSwap } from '../../../states/jotai/contexts/swap';

export function withSwapProvider<T extends React.PropsWithChildren>(
  WrappedComponent: React.ComponentType<T>,
): React.ComponentType<T> {
  return function WithSwapProvider(props: T): JSX.Element {
    return (
      <ProviderJotaiContextSwap>
        <WrappedComponent {...props} />
      </ProviderJotaiContextSwap>
    );
  };
}
