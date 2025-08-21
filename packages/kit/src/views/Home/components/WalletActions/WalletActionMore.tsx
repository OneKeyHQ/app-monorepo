import { useCallback } from 'react';

import { Divider } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { getRewardCenterConfig } from '@onekeyhq/kit/src/components/RewardCenter';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListProviderMirrorWrapper } from '../HomeTokenListProvider';

import { RawActions } from './RawActions';
import { WalletActionBuy } from './WalletActionBuy';
import { WalletActionCopy } from './WalletActionCopy';
import { WalletActionExport } from './WalletActionExport';
import { WalletActionRewardCenter } from './WalletActionRewardCenter';
import { WalletActionSell } from './WalletActionSell';
import { WalletActionViewInExplorer } from './WalletActionViewInExplorer';

export function WalletActionMore() {
  const [devSettings] = useDevSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, network } = activeAccount;

  const show = useReviewControl();

  const rewardCenterConfig = getRewardCenterConfig({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
  });

  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;

  const renderItemsAsync = useCallback(
    async ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
    }) => {
      return (
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.home,
          }}
          enabledNum={[0]}
        >
          <HomeTokenListProviderMirrorWrapper
            accountId={activeAccount?.account?.id ?? ''}
          >
            {show ? (
              <>
                <WalletActionBuy onClose={handleActionListClose} />
                <WalletActionSell onClose={handleActionListClose} />
              </>
            ) : null}
            {!vaultSettings?.copyAddressDisabled ||
            !vaultSettings?.hideBlockExplorer ||
            rewardCenterConfig ? (
              <Divider mx="$2" my="$1" />
            ) : null}
            {!vaultSettings?.hideBlockExplorer ? (
              <WalletActionViewInExplorer onClose={handleActionListClose} />
            ) : null}
            {!vaultSettings?.copyAddressDisabled ? (
              <WalletActionCopy onClose={handleActionListClose} />
            ) : null}
            {rewardCenterConfig ? (
              <WalletActionRewardCenter
                onClose={handleActionListClose}
                rewardCenterConfig={rewardCenterConfig}
              />
            ) : null}
            {devSettings?.settings?.showDevExportPrivateKey ? (
              <>
                <Divider mx="$2" my="$1" />
                <WalletActionExport onClose={handleActionListClose} />
              </>
            ) : null}
          </HomeTokenListProviderMirrorWrapper>
        </AccountSelectorProviderMirror>
      );
    },
    [
      activeAccount?.account?.id,
      devSettings?.settings?.showDevExportPrivateKey,
      rewardCenterConfig,
      show,
      vaultSettings?.copyAddressDisabled,
      vaultSettings?.hideBlockExplorer,
    ],
  );

  return <RawActions.More renderItemsAsync={renderItemsAsync} />;
}
