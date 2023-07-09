import type { ComponentType, FC, ReactElement } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const css1 = 'debug-render-tracker-animated-bg';
const css2 = 'debug-render-tracker-animated-bg0';
let lastClassName = css1;

function DebugRenderTracker(props: { children: ReactElement }): ReactElement {
  const { children } = props;
  if (process.env.NODE_ENV !== 'production') {
    if (platformEnv.isRuntimeBrowser) {
      lastClassName = lastClassName === css1 ? css2 : css1;
      return <div className={lastClassName}>{children}</div>;
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
