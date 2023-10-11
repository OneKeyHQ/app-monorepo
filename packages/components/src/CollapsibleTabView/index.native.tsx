// iOS and Android
import { forwardRef } from 'react';

import { FreezeTab } from './FreezeTab';
import { TabContainerNative } from './TabContainerNative';

export const Tabs = {
  Container: forwardRef(TabContainerNative),
  Tab: FreezeTab,
};
