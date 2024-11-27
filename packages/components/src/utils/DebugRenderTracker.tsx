import { type ComponentType, type FC, type ReactElement, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

const css1 = 'debug-render-tracker-animated-bg';
const css2 = 'debug-render-tracker-animated-bg0';

function DebugRenderTracker(props: { children: ReactElement }): ReactElement {
  const { children } = props;
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
            <div className="debug-render-tracker-times-badge">
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
