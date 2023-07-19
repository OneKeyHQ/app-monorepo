import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getAppRootTabInfoOfTab,
  isAtAppRootTab,
  isModalRouteExisting,
} from '../utils/routeUtils';

import DelayedFreeze from './DelayedFreeze';

import type { TabRoutes } from '../routes/routesEnum';

export interface ILazyRenderWhenFocusProps {
  unmountWhenBlur?: boolean;
  freezeWhenBlur?: boolean;
  children?: any | null;
  rootTabName?: TabRoutes;
}

export function LazyRenderWhenFocus({
  children,
  unmountWhenBlur,
  freezeWhenBlur = true,
  rootTabName,
}: ILazyRenderWhenFocusProps) {
  const isFocusedRef = useRef(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      isFocusedRef.current = true;
    }
  }, [isFocused]);

  const shouldFreeze = useMemo(() => {
    let shouldFreezeFlag = !isFocused;
    let isSameRootTab = false;

    if (shouldFreezeFlag) {
      const isModalOpen = isModalRouteExisting();
      if (isModalOpen) {
        shouldFreezeFlag = false;
      }
    }

    // native app render Freeze as white screen when route navigation
    if (platformEnv.isNativeIOS) {
      // TODO ios lazy render makes popover not working
      shouldFreezeFlag = false;

      if (shouldFreezeFlag && rootTabName) {
        isSameRootTab = isAtAppRootTab(rootTabName);
        if (isSameRootTab) {
          shouldFreezeFlag = false;
        }
      }
      if (shouldFreezeFlag && rootTabName && isSameRootTab) {
        const info = getAppRootTabInfoOfTab(rootTabName);
        const routes = info?.state?.routes;
        if (routes && routes?.length <= 2) {
          shouldFreezeFlag = false;
        }
      }
    }

    return shouldFreezeFlag;
  }, [rootTabName, isFocused]);

  if (shouldFreeze && unmountWhenBlur) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  // const childrenRouteKey = children?.props?.route?.key;
  // console.log('Component freeze:', { cmp: childrenRouteKey, shouldFreeze });
  if (shouldFreeze) {
    console.log('LazyRenderWhenFocus >>>>>>>>>> ', {
      shouldFreeze,
      rootTabName,
    });
  }

  const content = (
    <DelayedFreeze freeze={shouldFreeze && freezeWhenBlur}>
      {isFocusedRef.current || isFocused ? children : null}
    </DelayedFreeze>
  );
  return content;
}

export function toFocusedLazy(
  CmpClass: any,
  lazyProps?: ILazyRenderWhenFocusProps,
) {
  if (platformEnv.isNative || platformEnv.isDesktop) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return CmpClass;
  }

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
