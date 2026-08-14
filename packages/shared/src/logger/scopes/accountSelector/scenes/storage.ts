import { LogToConsoleDevOnly } from '../../../base/decorators';

import { AccountSelectorDevOnlyScene } from './devOnlyScene';

type ISelectedAccountLike = {
  deriveType?: string;
  focusedWallet?: unknown;
  indexedAccountId?: string;
  networkId?: string;
  othersWalletAccountId?: string;
  walletId?: string;
};

function buildSelectionSummary(selectedAccount: ISelectedAccountLike) {
  let accountKind = 'none';
  if (selectedAccount.indexedAccountId) {
    accountKind = 'indexed';
  } else if (selectedAccount.othersWalletAccountId) {
    accountKind = 'others';
  }
  return {
    accountKind,
    deriveType: selectedAccount.deriveType,
    hasFocusedWallet: Boolean(selectedAccount.focusedWallet),
    hasNetwork: Boolean(selectedAccount.networkId),
    hasWallet: Boolean(selectedAccount.walletId),
  };
}

export class AccountSelectorStorageScene extends AccountSelectorDevOnlyScene {
  @LogToConsoleDevOnly()
  public updateSelectedAccount({
    sceneName,
    num,
    sceneUrl,
    oldSelectedAccount,
    newSelectedAccount,
  }: {
    sceneName: string | undefined;
    num: number;
    sceneUrl: string | undefined;
    oldSelectedAccount: ISelectedAccountLike;
    newSelectedAccount: ISelectedAccountLike;
  }) {
    return [
      sceneName,
      num,
      {
        current: buildSelectionSummary(newSelectedAccount),
        hasSceneUrl: Boolean(sceneUrl),
        previous: buildSelectionSummary(oldSelectedAccount),
      },
    ];
  }

  @LogToConsoleDevOnly()
  public syncFromScene({
    sceneName,
    num,
    sceneUrl,
  }: {
    sceneName: string | undefined;
    num: number;
    sceneUrl: string | undefined;
  }) {
    return [sceneName, num, { hasSceneUrl: Boolean(sceneUrl) }];
  }

  @LogToConsoleDevOnly()
  public autoSelectNextAccount({
    sceneName,
    num,
    sceneUrl,
  }: {
    sceneName: string | undefined;
    num: number;
    sceneUrl: string | undefined;
  }) {
    return [sceneName, num, { hasSceneUrl: Boolean(sceneUrl) }];
  }

  @LogToConsoleDevOnly()
  public syncSceneData({
    selectedAccount,
    eventPayloadUpdatedAt,
    currentUpdatedAt,
  }: {
    selectedAccount: ISelectedAccountLike;
    eventPayloadUpdatedAt: number | undefined;
    currentUpdatedAt: number | undefined;
  }) {
    return [
      {
        selection: buildSelectionSummary(selectedAccount),
        eventPayloadUpdatedAt,
        currentUpdatedAt,
      },
    ];
  }
}
