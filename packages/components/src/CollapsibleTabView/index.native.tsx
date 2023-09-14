// iOS and Android
import { forwardRef } from 'react';

import { LazyTab } from './LazyTab';
import { TabContainerNative } from './TabContainerNative';

export const Tabs = {
  Container: forwardRef(TabContainerNative),
  Tab: LazyTab,
};
