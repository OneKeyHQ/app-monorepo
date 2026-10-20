import { createContext } from 'react';

import type { Dialog } from '@onekeyhq/components';

export const TradingViewChartDialogContext = createContext<
  typeof Dialog.show | undefined
>(undefined);
