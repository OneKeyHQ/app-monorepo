import { SwapProviderMirror } from './SwapProviderMirror';

export function withSwapProvider<T extends React.PropsWithChildren>(
  WrappedComponent: React.ComponentType<T>,
): React.ComponentType<T> {
  return function WithSwapProvider(props: T): JSX.Element {
    return (
      <SwapProviderMirror>
        <WrappedComponent {...props} />
      </SwapProviderMirror>
    );
  };
}
