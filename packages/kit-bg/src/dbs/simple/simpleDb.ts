import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SimpleDbEntityBrowserBookmarks } from './entity/SimpleDbEntityBrowserBookmarks';
import { SimpleDbEntityBrowserHistory } from './entity/SimpleDbEntityBrowserHistory';
import { SimpleDbEntityBrowserTabs } from './entity/SimpleDbEntityBrowserTabs';

class SimpleDb {
  browserTabs = new SimpleDbEntityBrowserTabs();

  browserBookmarks = new SimpleDbEntityBrowserBookmarks();

  browserHistory = new SimpleDbEntityBrowserHistory();
}

// eslint-disable-next-line import/no-mutable-exports
let simpleDb: SimpleDb;

if (platformEnv.isExtensionUi) {
  simpleDb = new Proxy(
    {},
    {
      get() {
        throw new Error('[simpleDb] is NOT allowed in UI process currently.');
      },
    },
  ) as SimpleDb;
} else {
  simpleDb = new SimpleDb();
}

if (process.env.NODE_ENV !== 'production') {
  global.$$simpleDb = simpleDb;
}

export default simpleDb;
