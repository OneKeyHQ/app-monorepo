import { OneKeyLocalError } from '../../errors';

import type { IMarketWidgetModule } from './types';

const marketWidget: IMarketWidgetModule = {
  isSupported: () => false,
  supportsStockAssets: () => false,
  supportsProfileEditing: () => false,
  supportsSettingsEditing: () => false,
  setConfiguration: async () => undefined,
  getEditorState: async () => {
    throw new OneKeyLocalError('Market widget profile editing is unavailable');
  },
  saveProfile: async () => {
    throw new OneKeyLocalError('Market widget profile editing is unavailable');
  },
  saveSettings: async () => {
    throw new OneKeyLocalError('Market widget settings are unavailable');
  },
};

export default marketWidget;
