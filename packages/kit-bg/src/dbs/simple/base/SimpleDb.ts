import { SimpleDbEntityAccountSelector } from '../entity/SimpleDbEntityAccountSelector';
import { SimpleDbEntityAddressBook } from '../entity/SimpleDbEntityAddressBook';
import { SimpleDbEntityBrowserBookmarks } from '../entity/SimpleDbEntityBrowserBookmarks';
import { SimpleDbEntityBrowserHistory } from '../entity/SimpleDbEntityBrowserHistory';
import { SimpleDbEntityBrowserTabs } from '../entity/SimpleDbEntityBrowserTabs';
import { SimpleDbEntityDappConnection } from '../entity/SimpleDbEntityDappConnection';
import { SimpleDbEntityLocalHistory } from '../entity/SimpleDbEntityLocalHistory';
import { SimpleDbEntityLocalTokens } from '../entity/SimpleDbEntityLocalTokens';
import { SimpleDbEntityRiskyTokens } from '../entity/SimpleDbEntityRiskyTokens';

export class SimpleDb {
  browserTabs = new SimpleDbEntityBrowserTabs();

  browserBookmarks = new SimpleDbEntityBrowserBookmarks();

  dappConnection = new SimpleDbEntityDappConnection();

  browserHistory = new SimpleDbEntityBrowserHistory();

  accountSelector = new SimpleDbEntityAccountSelector();

  localTokens = new SimpleDbEntityLocalTokens();

  addressBook = new SimpleDbEntityAddressBook();

  localHistory = new SimpleDbEntityLocalHistory();

  riskyTokens = new SimpleDbEntityRiskyTokens();
}
