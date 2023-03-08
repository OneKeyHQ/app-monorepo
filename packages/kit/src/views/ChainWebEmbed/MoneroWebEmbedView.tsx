import { forwardRef } from 'react';

import { ChainWebEmbedView } from './ChainWebEmbedView';

const ROUTE_PATH = '/monero';

const MoneroWebEmbedView = forwardRef(
  (
    {
      callback,
    }: {
      callback: (() => void) | null;
    },
    ref: any,
  ) => (
    <ChainWebEmbedView routePath={ROUTE_PATH} ref={ref} callback={callback} />
  ),
);

MoneroWebEmbedView.displayName = 'MoneroWebEmbedView';

export { MoneroWebEmbedView };
