import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAlignPrimaryAccountMode } from '@onekeyhq/shared/types/dappConnection';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

function SyncDappAccountToHomeCmp({
  dAppAccountInfos,
}: {
  origin: string;
  dAppAccountInfos: IConnectionAccountInfo[] | null;
}) {
  const actions = useAccountSelectorActions();
  const [settings] = useSettingsPersistAtom();

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
    };
    void sync();
  }, [dAppAccountInfos, actions, settings.alignPrimaryAccountMode]);

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

export default SyncDappAccountToHomeProvider;
