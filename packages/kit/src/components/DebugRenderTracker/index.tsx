import { type ComponentType, type FC, type ReactElement, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const css1 = 'debug-render-tracker-animated-bg';
const css2 = 'debug-render-tracker-animated-bg0';

function DebugRenderTracker(props: { children: ReactElement }): ReactElement {
  const { children } = props;
  const classRef = useRef<typeof css1 | typeof css2>(css1);
  if (process.env.NODE_ENV !== 'production') {
    if (platformEnv.isRuntimeBrowser) {
      classRef.current = classRef.current === css1 ? css2 : css1;
      return <div className={classRef.current}>{children}</div>;
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
export { withDebugRenderTracker, DebugRenderTracker };
