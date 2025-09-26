/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import type { ComponentType, FC, ReactNode } from 'react';
import { useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

import { Toast } from '../actions';

const css1 = 'debug-render-tracker-animated-bg';
const css2 = 'debug-render-tracker-animated-bg0';

function DebugRenderTracker(props: {
  name?: string;
  children: ReactNode;
  timesBadgePosition?:
    | 'top-right'
    | 'top-left'
    | 'top-center'
    | 'right-center'
    | 'bottom-right'
    | 'bottom-center'
    | 'bottom-left'
    | 'left-center';
}): ReactNode {
  const { children, timesBadgePosition = 'top-left' } = props;
  const classRef = useRef<typeof css1 | typeof css2>(css1);
  const renderTimesRef = useRef(0);
  if (process.env.NODE_ENV !== 'production') {
    if (platformEnv.isRuntimeBrowser) {
      const isDebugRenderTrackerEnabled = appStorage.syncStorage.getBoolean(
        EAppSyncStorageKeys.onekey_debug_render_tracker,
      );
      if (isDebugRenderTrackerEnabled) {
        classRef.current = classRef.current === css1 ? css2 : css1;
        renderTimesRef.current += 1;

        const divElement = (
          <div className={classRef.current}>
            <div
              onClick={() => {
                Toast.message({
                  title: props.name || 'unknown tracker name',
                });
              }}
              style={{
                cursor: 'zoom-in',
              }}
              className={`debug-render-tracker-times-badge ${timesBadgePosition}`}
            >
              {renderTimesRef.current}
            </div>
            {children}
          </div>
        );
        return divElement;
        // const clonedElement = cloneElement(children, {
        //   className: classRef.current, // not working for FlatList
        // });
        // return clonedElement;
      }
    }
  }

  return children;
}

const withDebugRenderTracker = <P extends object>(
  WrappedComponent: ComponentType<P>,
) => {
  const WithRenderTracker: FC<P> = (props) => (
    <DebugRenderTracker>
      <WrappedComponent {...props} />
    </DebugRenderTracker>
  );

  return WithRenderTracker;
};
export { DebugRenderTracker, withDebugRenderTracker };
