import { forwardRef } from 'react';

import { ChainWebEmbedView } from './ChainWebEmbedView';

const ROUTE_PATH = '/monero';

const ChainWebEmbedViewMonero = forwardRef(
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

ChainWebEmbedViewMonero.displayName = 'ChainWebEmbedViewMonero';

export { ChainWebEmbedViewMonero };
