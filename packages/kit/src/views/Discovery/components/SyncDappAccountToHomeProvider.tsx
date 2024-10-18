import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
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
