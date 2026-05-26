import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function WalletActionAddressList({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, network, wallet } = activeAccount;
  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();
  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );

  const enabled =
    Boolean(account?.id) &&
    Boolean(network?.id) &&
    Boolean(wallet?.id) &&
    accountUtils.isEnabledBtcFreshAddress({
      enableBTCFreshAddress,
      networkId: network?.id,
      walletId: wallet?.id,
    });

  const handlePress = useCallback(async () => {
    if (!account?.id || !network?.id || !wallet?.id) return;
    if (
      shouldBlockBotWalletReceive({
        isBotWallet,
        isBotWalletDeactivated,
      })
    ) {
      showBotWalletDisabledToast('receive');
      return;
    }
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet.id,
      })
    ) {
      return;
    }
    onClose();
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.BtcAddresses,
      params: {
        networkId: network.id,
        accountId: account.id,
        walletId: wallet.id,
        deriveInfo: undefined,
      },
    });
  }, [
    account?.id,
    isBotWallet,
    isBotWalletDeactivated,
    navigation,
    network?.id,
    onClose,
    wallet?.id,
  ]);

  if (!enabled) return null;

  return (
    <ActionList.Item
      trackID="wallet-address-list"
      icon="BulletListOutline"
      label={intl.formatMessage({
        id: ETranslations.address_list__action,
      })}
      onClose={() => {}}
      onPress={handlePress}
    />
  );
}
