import { forwardRef } from 'react';

import type { IGeckoViewProps, IWebViewCommands } from './type';

const GeckoView = forwardRef<IWebViewCommands, IGeckoViewProps>(() => {
  return null;
});

GeckoView.displayName = 'GeckoView';

export default GeckoView;

export * from './type';
