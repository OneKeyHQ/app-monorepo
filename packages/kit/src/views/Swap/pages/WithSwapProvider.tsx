import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { SwapProviderMirror } from './SwapProviderMirror';

export function withSwapProvider<T extends React.PropsWithChildren>(
  WrappedComponent: React.ComponentType<T>,
  storeName: EJotaiContextStoreNames,
): React.ComponentType<T> {
  return function WithSwapProvider(props: T): JSX.Element {
    return (
      <SwapProviderMirror storeName={storeName}>
        <WrappedComponent {...props} />
      </SwapProviderMirror>
    );
  };
}
