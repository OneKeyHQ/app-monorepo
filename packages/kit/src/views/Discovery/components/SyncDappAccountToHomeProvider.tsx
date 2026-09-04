import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorContextDataAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAlignPrimaryAccountMode } from '@onekeyhq/shared/types/dappConnection';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import { useSpotlight } from '../../../components/Spotlight';

export function useSyncDappAccountToHomeAccount() {
  const actions = useAccountSelectorActions();

  const syncDappAccountToWallet = useCallback(
    async ({
      dAppAccountInfos,
    }: {
      dAppAccountInfos: IConnectionAccountInfo[] | null;
    }) => {
      if (!Array.isArray(dAppAccountInfos) || dAppAccountInfos.length !== 1) {
        return;
      }

      const { serviceAccount } = backgroundApiProxy;
      const dAppAccount = dAppAccountInfos[0];
      const { indexedAccountId, accountId, networkId } = dAppAccount;
      const account = await serviceAccount.getAccount({
        accountId,
        networkId: networkId ?? '',
      });
      const isOtherWallet = accountUtils.isOthersAccount({
        accountId,
      });

      if (isOtherWallet) {
        setTimeout(
          () => {
            // Background alignment of the dApp account onto Home, not something
            // the user asked for right now, so a failure must stay silent: a
            // Toast here would interrupt whatever the user is doing in the dApp.
            // Home simply keeps its previous account; the log is the only trace.
            void actions.current
              .confirmAccountSelect({
                num: 0,
                indexedAccount: undefined,
                othersWalletAccount: account,
                autoChangeToAccountMatchedNetworkId: networkId,
                entry: 'syncDappAccountToHome:othersWallet',
              })
              .catch((error: unknown) => {
                defaultLogger.app.error.log(
                  `syncDappAccountToWallet confirmAccountSelect (others) failed: ${
                    (error as Error)?.message ?? String(error)
                  }`,
                );
              });
          },
          platformEnv.isExtension ? 200 : 0,
        );
      } else {
        const indexedAccount = await serviceAccount.getIndexedAccount({
          id: indexedAccountId ?? '',
        });
        setTimeout(
          () => {
            // Same background flow as the others-wallet branch above: swallow
            // the failure, keep Home on its previous account, and leave a log
            // entry instead of an unhandled rejection.
            void actions.current
              .confirmAccountSelect({
                num: 0,
                indexedAccount,
                othersWalletAccount: undefined,
                autoChangeToAccountMatchedNetworkId: undefined,
                entry: 'syncDappAccountToHome:indexedAccount',
                forceSelectToNetworkId: networkId,
              })
              .catch((error: unknown) => {
                defaultLogger.app.error.log(
                  `syncDappAccountToWallet confirmAccountSelect (indexed) failed: ${
                    (error as Error)?.message ?? String(error)
                  }`,
                );
              });
          },
          platformEnv.isExtension ? 200 : 0,
        );
      }
    },
    [actions],
  );

  return { syncDappAccountToWallet };
}

function SyncDappAccountToHomeCmp({
  dAppAccountInfos,
}: {
  origin: string;
  dAppAccountInfos: IConnectionAccountInfo[] | null;
}) {
  const actions = useAccountSelectorActions();
  const [settings] = useSettingsPersistAtom();
  const { syncDappAccountToWallet } = useSyncDappAccountToHomeAccount();
  const { isFirstVisit, tourVisited } = useSpotlight(
    ESpotlightTour.switchDappAccount,
  );
  const isFirstVisitRef = useRef(isFirstVisit);

  useEffect(() => {
    isFirstVisitRef.current = isFirstVisit;
  }, [isFirstVisit]);

  // Sync dApp account to home page
  useEffect(() => {
    const sync = async () => {
      if (
        settings.alignPrimaryAccountMode !==
        EAlignPrimaryAccountMode.AlignDappToWallet
      ) {
        return;
      }
      await syncDappAccountToWallet({
        dAppAccountInfos,
      });
      if (isFirstVisitRef.current) {
        void tourVisited(1);
      }
    };
    // Background alignment: the account lookups inside can reject on their own,
    // and this is not something the user asked for, so it stays silent in the
    // log rather than surfacing or becoming an unhandled rejection.
    void sync().catch((error) => {
      defaultLogger.app.error.log(
        `SyncDappAccountToHome failed: ${
          (error as Error | undefined)?.message || String(error)
        }`,
      );
    });
  }, [
    dAppAccountInfos,
    actions,
    settings.alignPrimaryAccountMode,
    tourVisited,
    syncDappAccountToWallet,
  ]);

  return null;
}

export function SyncHomeAccountPageToDappAccount() {
  const [accountSelectorContextData] = useAccountSelectorContextDataAtom();
  const actions = useAccountSelectorActions();
  useEffect(() => {
    const fn = async (params: {
      expectedSelectedAccount: IAccountSelectorSelectedAccount;
      selectedAccount: IAccountSelectorSelectedAccount;
    }) => {
      if (
        accountSelectorContextData?.sceneName !== EAccountSelectorSceneName.home
      ) {
        return;
      }
      await actions.current.updateSelectedAccount({
        expectedSelection: params.expectedSelectedAccount,
        num: 0,
        reason: 'syncDappAccountToHomeAccount',
        builder: () => params.selectedAccount,
      });
      void backgroundApiProxy.serviceDApp.setIsAlignPrimaryAccountProcessing({
        processing: false,
      });
    };
    appEventBus.on(EAppEventBusNames.SyncDappAccountToHomeAccount, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.SyncDappAccountToHomeAccount, fn);
    };
  }, [actions, accountSelectorContextData?.sceneName]);

  return null;
}

function SyncDappAccountToHomeProvider({
  origin,
  dAppAccountInfos,
}: {
  origin: string;
  dAppAccountInfos: IConnectionAccountInfo[] | null;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <SyncDappAccountToHomeCmp
        origin={origin}
        dAppAccountInfos={dAppAccountInfos}
      />
    </AccountSelectorProviderMirror>
  );
}

function SyncHomeAccountToDappAccountProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <SyncHomeAccountPageToDappAccount />
    </AccountSelectorProviderMirror>
  );
}

export { SyncHomeAccountToDappAccountProvider, SyncDappAccountToHomeProvider };
