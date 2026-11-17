import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LogToConsoleDevOnly } from '../../../base/decorators';

import { AccountSelectorDevOnlyScene } from './devOnlyScene';
import { recordAccountSelectorPerfE2ETrace } from './perfE2E';

type ISelectedAccountLike = {
  deriveType?: string;
  focusedWallet?: unknown;
  indexedAccountId?: string;
  networkId?: string;
  othersWalletAccountId?: string;
  walletId?: string;
};
type INamedEntityLike = { name?: string };

export type TAccountSelectorPerfEventName =
  | 'accountSelectRequested'
  | 'accountSelectResult'
  | 'activeAccountInteraction'
  | 'activeBuildResult'
  | 'activeReloadCancelled'
  | 'activeReloadCoalesced'
  | 'activeReloadDispatch'
  | 'activeReloadNotRequired'
  | 'activeReloadPostProcessResult'
  | 'activeReloadResult'
  | 'activeReloadScheduled'
  | 'activeReloadStart'
  | 'autoDeriveRequested'
  | 'autoDeriveResult'
  | 'autoDeriveSyncRequested'
  | 'autoDeriveSyncResult'
  | 'autoSelectAccountRequested'
  | 'autoSelectAccountResult'
  | 'autoSelectAccountStart'
  | 'autoSelectNetwork'
  | 'availableNetworksRequested'
  | 'availableNetworksResult'
  | 'crossSceneSyncRequested'
  | 'crossSceneSyncResult'
  | 'consumerReadSkipped'
  | 'dappConnectionAccountObserved'
  | 'effectsHostCommit'
  | 'repeatedStaleDropsDetected'
  | 'effectsStateObserved'
  | 'externalActivationRequested'
  | 'externalActivationResult'
  | 'globalDeriveEventCoalesced'
  | 'globalDeriveEventDispatched'
  | 'globalDeriveEventScheduled'
  | 'manualSceneSyncRequested'
  | 'manualSceneSyncResult'
  | 'mirrorTrackerCommit'
  | 'mirrorTrackerRegistration'
  | 'providerSubtreeCommit'
  | 'providerSubtreePaint'
  | 'providerUntrackedCommitBatch'
  | 'selectionStateUpdated'
  | 'selectionRefresh'
  | 'storageInitRequested'
  | 'storageInitResult'
  | 'selectionStorageCoalesced'
  | 'selectionStorageRequested'
  | 'selectionStorageResult'
  | 'selectionStorageSkipped'
  | 'selectionUpdateRequested'
  | 'selectionUpdateResult'
  | 'selectionUpdateStart'
  | 'unavailableSelectionStorageRequested'
  | 'unavailableSelectionStorageResult'
  | 'walletDeprecatedStatusUpdateResult'
  | 'walletLookupFailed';

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

export class AccountSelectorPerfScene extends AccountSelectorDevOnlyScene {
  override _emitLog(
    methodName: string,
    args: unknown[],
    metadataList: Parameters<AccountSelectorDevOnlyScene['_emitLog']>[2],
  ) {
    if (platformEnv.isE2E && methodName === 'trace') {
      recordAccountSelectorPerfE2ETrace(args[0]);
    }
    return super._emitLog(methodName, args, metadataList);
  }

  @LogToConsoleDevOnly()
  public trace(
    event: TAccountSelectorPerfEventName,
    payload: Record<string, unknown>,
  ) {
    return [{ ...payload, event, runtimeRole: platformEnv.runtimeRole }];
  }

  /** @deprecated Use trace() so event names remain typed and queryable. */
  @LogToConsoleDevOnly()
  public override consoleLog(...args: unknown[]) {
    return args as unknown;
  }

  @LogToConsoleDevOnly()
  public buildActiveAccountInfoFromSelectedAccount({
    selectedAccount,
  }: {
    selectedAccount: ISelectedAccountLike;
  }) {
    return [buildSelectionSummary(selectedAccount)];
  }

  @LogToConsoleDevOnly()
  public showAccountSelector(params: {
    sceneName: string;
    sceneUrl?: string;
    num: number;
  }) {
    return [
      {
        hasSceneUrl: Boolean(params.sceneUrl),
        num: params.num,
        sceneName: params.sceneName,
      },
    ];
  }

  @LogToConsoleDevOnly()
  public renderAccountSelectorModal(params: {
    sceneName: string;
    sceneUrl?: string;
    num: number;
    linkNetwork?: boolean;
    linkNetworkId?: string;
    linkNetworkDeriveType?: string;
  }) {
    return [
      {
        hasLinkNetworkId: Boolean(params.linkNetworkId),
        hasSceneUrl: Boolean(params.sceneUrl),
        linkNetwork: params.linkNetwork,
        linkNetworkDeriveType: params.linkNetworkDeriveType,
        num: params.num,
        sceneName: params.sceneName,
      },
    ];
  }

  @LogToConsoleDevOnly()
  public buildWalletListSideBarData() {
    return [true];
  }

  @LogToConsoleDevOnly()
  public renderWalletListSideBar(params: {
    selectedAccount: ISelectedAccountLike;
    walletsCount: number;
  }) {
    return [
      {
        selection: buildSelectionSummary(params.selectedAccount),
        walletsCount: params.walletsCount,
      },
    ];
  }

  @LogToConsoleDevOnly()
  public renderAccountsList({
    selectedAccount,
    editMode,
  }: {
    editMode?: boolean;
    selectedAccount: ISelectedAccountLike;
  }) {
    return [buildSelectionSummary(selectedAccount), { editMode }];
  }

  @LogToConsoleDevOnly()
  buildAccountSelectorAccountsListData(params: {
    focusedWallet: unknown;
    othersNetworkId?: string;
    linkedNetworkId?: string;
    deriveType: string;
  }) {
    return [
      {
        deriveType: params.deriveType,
        hasFocusedWallet: Boolean(params.focusedWallet),
        hasLinkedNetwork: Boolean(params.linkedNetworkId),
        hasOthersNetwork: Boolean(params.othersNetworkId),
      },
    ];
  }

  @LogToConsoleDevOnly()
  public renderAccountsSectionList(params: {
    walletName: string | undefined;
    accountsCount: number;
  }) {
    return [
      {
        accountsCount: params.accountsCount,
        hasWalletName: Boolean(params.walletName),
      },
    ];
  }

  @LogToConsoleDevOnly()
  public render_Accounts_SectionList_Mock() {
    return [true];
  }

  @LogToConsoleDevOnly()
  public renderWalletOptions({
    wallet,
  }: {
    wallet: INamedEntityLike | undefined;
  }) {
    return [{ hasWallet: Boolean(wallet) }];
  }

  @LogToConsoleDevOnly()
  public renderAccountEditOptions({
    wallet,
    indexedAccount,
    account,
  }: {
    wallet: INamedEntityLike | undefined;
    indexedAccount?: INamedEntityLike;
    account?: INamedEntityLike;
  }) {
    return [
      {
        hasAccount: Boolean(account),
        hasIndexedAccount: Boolean(indexedAccount),
        hasWallet: Boolean(wallet),
      },
    ];
  }
}
