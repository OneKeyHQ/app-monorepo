import { OneKeyLocalError } from '../../errors';

import type { IMarketWidgetModule } from './types';

const marketWidget: IMarketWidgetModule = {
  isSupported: () => false,
  supportsProfileEditing: () => false,
  setConfiguration: async () => undefined,
  getEditorState: async () => {
    throw new OneKeyLocalError('Market widget profile editing is unavailable');
  },
  saveProfile: async () => {
    throw new OneKeyLocalError('Market widget profile editing is unavailable');
  },
};

export default marketWidget;
