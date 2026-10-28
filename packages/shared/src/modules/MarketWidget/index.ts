import type { IMarketWidgetModule } from './types';

const marketWidget: IMarketWidgetModule = {
  isSupported: () => false,
  setConfiguration: async () => undefined,
};

export default marketWidget;
