import { useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { Freeze } from 'react-freeze';

export interface ILazyRenderWhenFocusProps {
  unmountWhenBlur?: boolean;
  freezeWhenBlur?: boolean;
  children?: any | null;
}
export function LazyRenderWhenFocus({
  children,
  unmountWhenBlur,
  freezeWhenBlur = true,
}: ILazyRenderWhenFocusProps) {
  const isFocusedRef = useRef(false);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      isFocusedRef.current = true;
    }
  }, [isFocused]);
  let shouldFreeze = false;
  if (!isFocused) {
    if (unmountWhenBlur) {
      return null;
    }
    if (freezeWhenBlur) {
      shouldFreeze = true;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return (
    <Freeze freeze={shouldFreeze}>
      {isFocusedRef.current || isFocused ? children : null}
    </Freeze>
  );
}
export function toFocusedLazy(
  CmpClass: any,
  lazyProps?: ILazyRenderWhenFocusProps,
) {
  // return CmpClass;
  const lazyCmp = (props: any) => (
    <LazyRenderWhenFocus {...lazyProps}>
      <CmpClass {...props} />
    </LazyRenderWhenFocus>
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  lazyCmp.displayName = CmpClass?.displayName;
  return lazyCmp;
}
