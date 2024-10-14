import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

function SyncDappAccountToHomeCmp({
  dAppAccountInfos,
}: {
  dAppAccountInfos: IConnectionAccountInfo[];
}) {
  const actions = useAccountSelectorActions();
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
        });
      }
    };
    void sync();
  }, [dAppAccountInfos, actions]);
  return null;
}

function SyncDappAccountToHomeProvider({
  dAppAccountInfos,
}: {
  dAppAccountInfos: IConnectionAccountInfo[];
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <SyncDappAccountToHomeCmp dAppAccountInfos={dAppAccountInfos} />
    </AccountSelectorProviderMirror>
  );
}

export default SyncDappAccountToHomeProvider;
