import { useIsFocused } from '@react-navigation/core';

import DelayedFreeze from '../../DelayedFreeze';

export function tabRouteWrapper(
  WrappedComponent: any,
  freezeOnBlur: boolean | undefined,
): () => JSX.Element {
  return function TabLayoutWrapper() {
    const isFocused = useIsFocused();

    if (freezeOnBlur) {
      return (
        <DelayedFreeze freeze={!isFocused}>
          <WrappedComponent />
        </DelayedFreeze>
      );
    }

    return <WrappedComponent />;
  };
}
