import { useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getRootTabRouteState,
  isModalRouteExisting,
} from '../utils/routeUtils';

import DelayedFreeze from './DelayedFreeze';

export interface ILazyRenderWhenFocusProps {
  unmountWhenBlur?: boolean;
  freezeWhenBlur?: boolean;
  children?: any | null;
  isNativeEnabled?: boolean; // native app render Freeze as white screen when route navigation
  rootTabName?: string;
}
export function LazyRenderWhenFocus({
  children,
  unmountWhenBlur,
  freezeWhenBlur = true,
  isNativeEnabled = false,
  rootTabName,
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
    let shouldFreezeOrUnmount =
      !platformEnv.isNative || (platformEnv.isNative && isNativeEnabled);
    // shouldFreezeOrUnmount = false;
    if (!shouldFreezeOrUnmount) {
      const tabRouteState = getRootTabRouteState();
      if (tabRouteState && rootTabName) {
        const tabIndex = tabRouteState?.routes?.findIndex?.(
          (item) => item.name === rootTabName,
        );
        if (tabIndex !== tabRouteState?.index) {
          shouldFreezeOrUnmount = true;
        }
      }
    }
    if (shouldFreezeOrUnmount) {
      if (unmountWhenBlur) {
        return null;
      }
      if (freezeWhenBlur) {
        shouldFreeze = true;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  // const childrenRouteKey = children?.props?.route?.key;
  // console.log('Component freeze:', { cmp: childrenRouteKey, shouldFreeze });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return (
    <DelayedFreeze freeze={shouldFreeze}>
      {isFocusedRef.current || isFocused ? children : null}
    </DelayedFreeze>
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
