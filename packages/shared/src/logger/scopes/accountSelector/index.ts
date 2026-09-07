import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { AccountSelectorDevOnlyScene } from './scenes/devOnlyScene';
import { AccountSelectorFailureScene } from './scenes/failure';
import { AccountSelectorListDataScene } from './scenes/listData';
import { AccountSelectorStaleDropScene } from './scenes/staleDrop';

import type { AccountSelectorAutoSelectScene } from './scenes/autoSelect';
import type { AccountSelectorPerfScene } from './scenes/perf';
import type { AccountSelectorRenderScene } from './scenes/render';
import type { AccountSelectorStorageScene } from './scenes/storage';

const noop = () => undefined;

export class AccountSelectorScope extends BaseScope {
  protected override scopeName = EScopeName.accountSelector;

  private createNoopDevScene<T extends AccountSelectorDevOnlyScene>(
    name: string,
    methods: Record<
      Exclude<keyof T, keyof AccountSelectorDevOnlyScene>,
      typeof noop
    > & { consoleLog?: typeof noop },
  ): T {
    // Dev-only decorators already return undefined in production. Keep the
    // scene metadata/API while allowing the payload builders to be tree-shaken.
    return Object.assign(
      this.createScene(name, AccountSelectorDevOnlyScene),
      methods,
    ) as T;
  }

  render =
    process.env.NODE_ENV === 'production' && process.env.E2E_MODE !== 'true'
      ? this.createNoopDevScene<AccountSelectorRenderScene>('render', {
          selectAccount: noop,
          showAccountSelector: noop,
        })
      : this.createScene(
          'render',
          (require('./scenes/render') as typeof import('./scenes/render'))
            .AccountSelectorRenderScene,
        );

  perf =
    process.env.NODE_ENV === 'production' && process.env.E2E_MODE !== 'true'
      ? this.createNoopDevScene<AccountSelectorPerfScene>('perf', {
          trace: noop,
          consoleLog: noop,
          buildActiveAccountInfoFromSelectedAccount: noop,
          showAccountSelector: noop,
          renderAccountSelectorModal: noop,
          buildWalletListSideBarData: noop,
          renderWalletListSideBar: noop,
          renderAccountsList: noop,
          buildAccountSelectorAccountsListData: noop,
          renderAccountsSectionList: noop,
          render_Accounts_SectionList_Mock: noop,
          renderWalletOptions: noop,
          renderAccountEditOptions: noop,
        })
      : this.createScene(
          'perf',
          (require('./scenes/perf') as typeof import('./scenes/perf'))
            .AccountSelectorPerfScene,
        );

  storage =
    process.env.NODE_ENV === 'production' && process.env.E2E_MODE !== 'true'
      ? this.createNoopDevScene<AccountSelectorStorageScene>('storage', {
          updateSelectedAccount: noop,
          syncFromScene: noop,
          autoSelectNextAccount: noop,
          syncSceneData: noop,
        })
      : this.createScene(
          'storage',
          (require('./scenes/storage') as typeof import('./scenes/storage'))
            .AccountSelectorStorageScene,
        );

  autoSelect =
    process.env.NODE_ENV === 'production' && process.env.E2E_MODE !== 'true'
      ? this.createNoopDevScene<AccountSelectorAutoSelectScene>('autoSelect', {
          startAutoSelect: noop,
          currentSelectedAccount: noop,
          resetSelectedWalletToUndefined: noop,
        })
      : this.createScene(
          'autoSelect',
          (
            require('./scenes/autoSelect') as typeof import('./scenes/autoSelect')
          ).AccountSelectorAutoSelectScene,
        );

  listData = this.createScene('listData', AccountSelectorListDataScene);

  failure = this.createScene('failure', AccountSelectorFailureScene);

  staleDrop = this.createScene('staleDrop', AccountSelectorStaleDropScene);
}
