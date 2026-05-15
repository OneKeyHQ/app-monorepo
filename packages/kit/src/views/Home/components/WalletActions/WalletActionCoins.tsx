import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function WalletActionCoins({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, network, wallet } = activeAccount;
  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();

  const enabled =
    Boolean(account?.id) &&
    Boolean(network?.id) &&
    Boolean(wallet?.id) &&
    accountUtils.isEnabledBtcFreshAddress({
      enableBTCFreshAddress,
      networkId: network?.id,
      walletId: wallet?.id,
    });

  const handlePress = useCallback(() => {
    if (!account?.id || !network?.id || !wallet?.id) return;
    onClose();
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.BtcCoins,
      params: {
        networkId: network.id,
        accountId: account.id,
        walletId: wallet.id,
        deriveInfo: undefined,
      },
    });
  }, [account?.id, navigation, network?.id, onClose, wallet?.id]);

  if (!enabled) return null;

  return (
    <ActionList.Item
      trackID="wallet-coins"
      icon="CryptoCoinOutline"
      label={intl.formatMessage({ id: ETranslations.coins__action })}
      onClose={() => {}}
      onPress={handlePress}
    />
  );
}
