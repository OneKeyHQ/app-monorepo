import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import {
  addWebTab,
  closeWebTab,
  homeTab,
  setCurrentWebTab,
} from '../../../store/reducers/webTabs';

import type { WebTab } from '../../../store/reducers/webTabs';

export const dAddNewWebTab = (tabData?: Partial<WebTab>) => {
  backgroundApiProxy.dispatch(
    addWebTab({
      ...homeTab,
      ...tabData,
    }),
  );
};

export const dSetCurrentWebTab = (id: string) => {
  backgroundApiProxy.dispatch(setCurrentWebTab(id));
};
export const dCloseWebTab = (id: string) => {
  backgroundApiProxy.dispatch(closeWebTab(id));
};

export const dAddNewBlankWebTab = () => dAddNewWebTab();
