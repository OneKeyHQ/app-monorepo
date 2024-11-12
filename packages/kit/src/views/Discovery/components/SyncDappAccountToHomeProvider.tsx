import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EAlignPrimaryAccountMode } from '@onekeyhq/shared/types/dappConnection';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import { useSpotlight } from '../../../components/Spotlight';

function SyncDappAccountToHomeCmp({
  dAppAccountInfos,
}: {
  origin: string;
  dAppAccountInfos: IConnectionAccountInfo[] | null;
}) {
  const actions = useAccountSelectorActions();
  const [settings] = useSettingsPersistAtom();
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
        await actions.current.confirmAccountSelect({
          num: 0,
          indexedAccount: undefined,
          othersWalletAccount: account,
          autoChangeToAccountMatchedNetworkId: networkId,
        });
      } else {
        const indexedAccount = await serviceAccount.getIndexedAccount({
          id: indexedAccountId ?? '',
        });
        await actions.current.confirmAccountSelect({
          num: 0,
          indexedAccount,
          othersWalletAccount: undefined,
          autoChangeToAccountMatchedNetworkId: undefined,
          forceSelectToNetworkId: networkId,
        });
      }
      if (isFirstVisitRef.current) {
        void tourVisited(1);
      }
    };
    void sync();
  }, [
    dAppAccountInfos,
    actions,
    settings.alignPrimaryAccountMode,
    tourVisited,
  ]);

  return null;
}

function SyncHomeAccountPageToDappAccount({
  origin,
  dAppAccountInfos,
}: {
  origin: string;
  dAppAccountInfos: IConnectionAccountInfo[] | null;
}) {
  const [settings] = useSettingsPersistAtom();
  const {
    activeAccount: {
      wallet,
      account,
      indexedAccount,
      isOthersWallet,
      deriveType,
    },
  } = useActiveAccount({ num: 0 });
  useEffect(() => {
    if (
      settings.alignPrimaryAccountMode !==
      EAlignPrimaryAccountMode.AlwaysUsePrimaryAccount
    ) {
      return;
    }

    if (!Array.isArray(dAppAccountInfos) || dAppAccountInfos.length !== 1) {
      return;
    }

    console.log(
      '🚀 ~ SyncHomeAccountPageToDappAccount, current account: ',
      account,
    );

    const sync = async () => {
      let isSameAccount = false;

      if (isOthersWallet) {
        isSameAccount = account?.id === dAppAccountInfos[0].accountId;
      } else {
        isSameAccount =
          indexedAccount?.id === dAppAccountInfos[0].indexedAccountId;
      }
      if (!isSameAccount) {
        // await backgroundApiProxy.serviceDApp.disconnectWebsite({
        //   origin,
        //   storageType: 'injectedProvider',
        // });

        if (isOthersWallet) {
          const isCompatibleNetwork =
            accountUtils.isAccountCompatibleWithNetwork({
              // @ts-expect-error
              account,
              networkId: dAppAccountInfos[0].networkId ?? '',
            });
          if (!isCompatibleNetwork) {
            console.log(
              '====>>>=====>>>>>>>SyncDappAccountToHomeCmp No Compatible Network: ',
              account,
              dAppAccountInfos[0].networkId,
            );
            return;
          }
        }

        let networkAccount: INetworkAccount | undefined;
        try {
          networkAccount =
            await backgroundApiProxy.serviceAccount.getNetworkAccount({
              accountId: isOthersWallet ? account?.id ?? '' : undefined,
              indexedAccountId: isOthersWallet
                ? undefined
                : indexedAccount?.id ?? '',
              networkId: dAppAccountInfos[0].networkId ?? '',
              deriveType: dAppAccountInfos[0].deriveType ?? deriveType,
            });
        } catch (e) {
          console.log(
            '====>>>=====>>>>>>>SyncDappAccountToHomeCmp No Account: ',
            e,
          );
        }
        await backgroundApiProxy.serviceDApp.updateConnectionSession({
          origin,
          accountSelectorNum: dAppAccountInfos[0].num ?? 0,
          updatedAccountInfo: {
            walletId: wallet?.id ?? '',
            networkImpl: dAppAccountInfos[0].networkImpl,
            networkId: dAppAccountInfos[0].networkId,
            accountId: networkAccount?.id ?? '',
            address: networkAccount?.addressDetail.address ?? '',
            indexedAccountId: indexedAccount?.id ?? '',
            othersWalletAccountId: networkAccount?.id,
            deriveType: dAppAccountInfos[0].deriveType ?? deriveType,
            focusedWallet: wallet?.id ?? '',
          },
          storageType: 'injectedProvider',
        });

        // if (origin) {
        //   appEventBus.emit(EAppEventBusNames.OnSwitchDAppNetwork, {
        //     state: 'switching',
        //   });
        //   await timerUtils.wait(300);
        //   appEventBus.emit(EAppEventBusNames.OnSwitchDAppNetwork, {
        //     state: 'completed',
        //   });
        // }
      }
    };
    void sync();
  }, [
    settings.alignPrimaryAccountMode,
    dAppAccountInfos,
    account,
    indexedAccount,
    isOthersWallet,
    deriveType,
    wallet?.id,
    origin,
  ]);

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
      <SyncHomeAccountPageToDappAccount
        origin={origin}
        dAppAccountInfos={dAppAccountInfos}
      />
    </AccountSelectorProviderMirror>
  );
}

export default SyncDappAccountToHomeProvider;
