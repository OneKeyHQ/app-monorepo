import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  useAccountSelectorActions,
  // useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
// import {
//   EAppEventBusNames,
//   appEventBus,
// } from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
// import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
// import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

function SyncDappAccountToHomeCmp({
  dAppAccountInfos,
}: {
  origin: string;
  dAppAccountInfos: IConnectionAccountInfo[];
}) {
  const actions = useAccountSelectorActions();

  // Sync dApp account to home page
  useEffect(() => {
    const sync = async () => {
      console.log(
        '====>>>=====>>>>>>>SyncDappAccountToHomeProvider: ',
        dAppAccountInfos,
      );
      if (dAppAccountInfos.length !== 1) {
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
    };
    void sync();
  }, [dAppAccountInfos, actions]);

  // Sync home page account to dApp
  // const {
  //   activeAccount: {
  //     wallet,
  //     account,
  //     network,
  //     indexedAccount,
  //     isOthersWallet,
  //     deriveType,
  //   },
  // } = useActiveAccount({ num: 0 });
  // useEffect(() => {
  //   const sync = async () => {
  //     let isSameAccount = false;

  //     if (isOthersWallet) {
  //       isSameAccount = account?.id === dAppAccountInfos[0].accountId;
  //     } else {
  //       isSameAccount =
  //         indexedAccount?.id === dAppAccountInfos[0].indexedAccountId;
  //     }
  //     if (!isSameAccount) {
  //       // await backgroundApiProxy.serviceDApp.disconnectWebsite({
  //       //   origin,
  //       //   storageType: 'injectedProvider',
  //       // });

  //       if (isOthersWallet) {
  //         const isCompatibleNetwork =
  //           accountUtils.isAccountCompatibleWithNetwork({
  //             // @ts-expect-error
  //             account,
  //             networkId: dAppAccountInfos[0].networkId ?? '',
  //           });
  //         if (!isCompatibleNetwork) {
  //           console.log(
  //             '====>>>=====>>>>>>>SyncDappAccountToHomeCmp No Compatible Network: ',
  //             account,
  //             dAppAccountInfos[0].networkId,
  //           );
  //           return;
  //         }
  //       }

  //       let networkAccount: INetworkAccount | undefined;
  //       try {
  //         networkAccount =
  //           await backgroundApiProxy.serviceAccount.getNetworkAccount({
  //             accountId: isOthersWallet ? account?.id ?? '' : undefined,
  //             indexedAccountId: isOthersWallet
  //               ? undefined
  //               : indexedAccount?.id ?? '',
  //             networkId: dAppAccountInfos[0].networkId ?? '',
  //             deriveType: dAppAccountInfos[0].deriveType ?? deriveType,
  //           });
  //       } catch (e) {
  //         console.log(
  //           '====>>>=====>>>>>>>SyncDappAccountToHomeCmp No Account: ',
  //           e,
  //         );
  //       }
  //       await backgroundApiProxy.serviceDApp.updateConnectionSession({
  //         origin,
  //         accountSelectorNum: dAppAccountInfos[0].num ?? 0,
  //         updatedAccountInfo: {
  //           walletId: wallet?.id ?? '',
  //           networkImpl: dAppAccountInfos[0].networkImpl,
  //           networkId: dAppAccountInfos[0].networkId,
  //           accountId: networkAccount?.id ?? '',
  //           address: networkAccount?.addressDetail.address ?? '',
  //           indexedAccountId: indexedAccount?.id ?? '',
  //           othersWalletAccountId: networkAccount?.id,
  //           deriveType: dAppAccountInfos[0].deriveType ?? deriveType,
  //           focusedWallet: wallet?.id ?? '',
  //         },
  //         storageType: 'injectedProvider',
  //       });

  //       if (origin) {
  //         appEventBus.emit(EAppEventBusNames.OnSwitchDAppNetwork, {
  //           state: 'switching',
  //         });
  //         await timerUtils.wait(300);
  //         appEventBus.emit(EAppEventBusNames.OnSwitchDAppNetwork, {
  //           state: 'completed',
  //         });
  //       }
  //     }
  //   };
  //   // void sync();
  // }, [
  //   account,
  //   network,
  //   indexedAccount,
  //   isOthersWallet,
  //   dAppAccountInfos,
  //   origin,
  //   deriveType,
  //   wallet,
  // ]);
  return null;
}

function SyncDappAccountToHomeProvider({
  origin,
  dAppAccountInfos,
}: {
  origin: string;
  dAppAccountInfos: IConnectionAccountInfo[];
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

export default SyncDappAccountToHomeProvider;
