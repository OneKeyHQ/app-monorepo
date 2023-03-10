import { forwardRef } from 'react';

import { ChainWebEmbedView } from './ChainWebEmbedView';

const ROUTE_PATH = '/cardano';

const CardanoWebEmbedView = forwardRef(
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

CardanoWebEmbedView.displayName = 'CardanoWebEmbedView';

export { CardanoWebEmbedView };
