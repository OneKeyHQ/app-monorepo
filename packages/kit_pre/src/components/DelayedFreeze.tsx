// This component allows one more render before freezing the screen.

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Freeze } from 'react-freeze';

interface FreezeWrapperProps {
  freeze: boolean;
  children: ReactNode;
}

// https://github.com/software-mansion/react-native-screens/issues/1198#issuecomment-1306478805

// Allows activityState to reach the native side and useIsFocused to work correctly.
function DelayedFreeze({ freeze, children }: FreezeWrapperProps) {
  // flag used for determining whether freeze should be enabled
  const [freezeState, setFreezeState] = useState(false);

  useEffect(() => {
    setImmediate(() => {
      setFreezeState(freeze);
    });
  }, [freeze]);

  return <Freeze freeze={freeze ? freezeState : false}>{children}</Freeze>;
}
export default DelayedFreeze;
