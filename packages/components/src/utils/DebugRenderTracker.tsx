/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import type { ComponentType, FC, ReactNode } from 'react';
import { useRef, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

import { Toast } from '../actions';

const css1 = 'debug-render-tracker-animated-bg';
const css2 = 'debug-render-tracker-animated-bg0';
export type IDebugRenderTrackerPosition =
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'right-center'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-center';
export interface IDebugRenderTrackerProps {
  containerStyle?: React.HTMLAttributes<HTMLDivElement>['style'];
  name?: string;
  position?: IDebugRenderTrackerPosition;
  offsetX?: number;
  offsetY?: number;
}
function DebugRenderTracker(
  props: IDebugRenderTrackerProps & {
    children: ReactNode;
  },
): ReactNode {
  const {
    children,
    position = 'top-left',
    containerStyle,
    offsetX,
    offsetY,
  } = props;
  const [, setRefresh] = useState(0);
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
          <div
            className={classRef.current}
            style={{
              ...containerStyle,
            }}
          >
            <div
              onClick={() => {
                Toast.message({
                  title: `DebugRenderTracker`,
                  message: `${props.name || '[UnknownTrackerName]'}: ${
                    renderTimesRef.current
                  }`,
                });
                setRefresh(new Date().getTime());
              }}
              style={{
                cursor: 'zoom-in',
              }}
              className={`debug-render-tracker-times-badge ${position}`}
            >
              <div
                className="debug-render-tracker-times-badge-text"
                style={{
                  transform: `translate(${offsetX || 0}px, ${offsetY || 0}px)`,
                }}
              >
                {renderTimesRef.current}
              </div>
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
