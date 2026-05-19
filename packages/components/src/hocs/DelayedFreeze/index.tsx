import type { ReactNode } from 'react';
import { startTransition, useState } from 'react';

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
      if (freeze) {
        // Freezing must be urgent so the blurred tab stops rendering
        // immediately on tab switch.
        setFreezeState(true);
      } else {
        // Unfreezing (a tab regaining focus) triggers a full re-render of
        // the previously frozen sub-tree. Mark it as a transition so React
        // can yield to higher-priority work (the click handler ack, the
        // sidebar's active-state highlight) before re-mounting the heavy
        // page content.
        startTransition(() => setFreezeState(false));
      }
    });
  }

  return (
    <Freeze freeze={freeze ? freezeState : false} placeholder={placeholder}>
      {children}
    </Freeze>
  );
}
