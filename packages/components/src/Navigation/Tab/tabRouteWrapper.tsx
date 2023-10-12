import { useIsFocused } from '@react-navigation/core';

import DelayedFreeze from '../../DelayedFreeze';
import { Stack } from '../../Stack';
import { Freeze } from 'react-freeze';

export function tabRouteWrapper(
  WrappedComponent: any,
  freezeOnBlur: boolean | undefined,
  name: string | undefined,
): () => JSX.Element {
  return function TabLayoutWrapper() {
    const isFocused = useIsFocused();

    console.log('===== ', name, freezeOnBlur, isFocused);

    // if (freezeOnBlur) {
    //   return (
    //     <DelayedFreeze freeze={!isFocused}>
    //       <WrappedComponent />
    //     </DelayedFreeze>
    //   );
    // }

    return <WrappedComponent />;
  };
}
