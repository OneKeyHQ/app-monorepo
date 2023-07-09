import type { ComponentType, FC, ReactElement } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

let lastClassName = 'animated-bg';

function RenderTracker(props: { children: ReactElement }): ReactElement {
  const { children } = props;
  if (process.env.NODE_ENV !== 'production') {
    if (platformEnv.isRuntimeBrowser) {
      lastClassName =
        lastClassName === 'animated-bg' ? 'animated-bg0' : 'animated-bg';

      return <div className={lastClassName}>{children}</div>;
    }
  }

  return children;
}

const withRenderTracker = <P extends object>(
  WrappedComponent: ComponentType<P>,
) => {
  const WithRenderTracker: FC<P> = (props) => (
    <RenderTracker>
      <WrappedComponent {...props} />
    </RenderTracker>
  );

  return WithRenderTracker;
};
export { withRenderTracker, RenderTracker };
