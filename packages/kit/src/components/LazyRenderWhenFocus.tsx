import { useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { Freeze } from 'react-freeze';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { isModalRouteExisting } from '../utils/routeUtils';

export interface ILazyRenderWhenFocusProps {
  unmountWhenBlur?: boolean;
  freezeWhenBlur?: boolean;
  children?: any | null;
  isNativeEnabled?: boolean; // native app render Freeze as white screen when route navigation
}
export function LazyRenderWhenFocus({
  children,
  unmountWhenBlur,
  freezeWhenBlur = true,
  isNativeEnabled = false,
}: ILazyRenderWhenFocusProps) {
  const isFocusedRef = useRef(false);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      isFocusedRef.current = true;
    }
  }, [isFocused]);
  let shouldFreeze = false;
  const isModalOpen = isModalRouteExisting();
  if (!isFocused && !isModalOpen) {
    if (!platformEnv.isNative || (platformEnv.isNative && isNativeEnabled)) {
      if (unmountWhenBlur) {
        return null;
      }
      if (freezeWhenBlur) {
        shouldFreeze = true;
      }
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
