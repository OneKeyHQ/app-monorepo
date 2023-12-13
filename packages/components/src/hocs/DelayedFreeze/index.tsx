import type { ReactNode } from 'react';
import { useState } from 'react';

import { Freeze } from 'react-freeze';

export interface IFreezeWrapperProps {
  freeze: boolean | undefined;
  children: ReactNode;
  placeholder?: ReactNode;
}

// https://github.com/software-mansion/react-native-screens/blob/24689052c009f383657a74521c5ce875044ee2ef/src/index.native.tsx#L186C1-L206C2
// https://github.com/software-mansion/react-native-screens/issues/1198#issuecomment-1306478805

// This component allows one more render before freezing the screen.
// Allows activityState to reach the native side and useIsFocused to work correctly.
export function DelayedFreeze({
  freeze,
  children,
  placeholder = null,
}: IFreezeWrapperProps): JSX.Element {
  // flag used for determining whether freeze should be enabled
  const [freezeState, setFreezeState] = useState(false);

  if (freeze !== freezeState) {
    // setImmediate is executed at the end of the JS execution block.
    // Used here for changing the state right after the render.
    setImmediate(() => {
      setFreezeState(!!freeze);
    });
  }

  return (
    <Freeze freeze={freeze ? freezeState : false} placeholder={placeholder}>
      {children}
    </Freeze>
  );
}
