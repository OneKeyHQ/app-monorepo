import { forwardRef, useImperativeHandle, useState } from 'react';
import type { ForwardedRef, PropsWithChildren } from 'react';

import { Freeze } from 'react-freeze';

export type IFreezeContainerRef = {
  setFreeze: (freeze: boolean) => void;
};

function RawFreezeContainer(
  { children, initialFreeze }: PropsWithChildren & { initialFreeze: boolean },
  ref: ForwardedRef<IFreezeContainerRef>,
) {
  const [freeze, setFreeze] = useState(initialFreeze);
  useImperativeHandle(ref, () => ({
    setFreeze,
  }));
  return <Freeze freeze={freeze}>{children}</Freeze>;
}

export const FreezeContainer = forwardRef(RawFreezeContainer);
