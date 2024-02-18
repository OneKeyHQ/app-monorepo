import { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import { SimpleDbEntityBrowserBookmarks } from '../entity/SimpleDbEntityBrowserBookmarks';
import { SimpleDbEntityBrowserHistory } from '../entity/SimpleDbEntityBrowserHistory';
import { SimpleDbEntityBrowserTabs } from '../entity/SimpleDbEntityBrowserTabs';
import { SimpleDbEntityLocalHistory } from '../entity/SimpleDbEntityLocalHistory';
import { SimpleDbEntityDappConnection } from '../entity/SimpleDbEntityDappConnection';
import { SimpleDbEntityLocalTokens } from '../entity/SimpleDbEntityLocalTokens';

export class SimpleDb {
  browserTabs = new SimpleDbEntityBrowserTabs();

  browserBookmarks = new SimpleDbEntityBrowserBookmarks();

  dappConnection = new SimpleDbEntityDappConnection();

  browserHistory = new SimpleDbEntityBrowserHistory();

  accountSelector = new SimpleDbEntityAccountSelector();

  localTokens = new SimpleDbEntityLocalTokens();

  localHistory = new SimpleDbEntityLocalHistory();
}
