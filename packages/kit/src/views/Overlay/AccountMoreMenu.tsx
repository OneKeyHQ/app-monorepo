import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { useToast } from '@onekeyhq/components';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import type { AccountDynamicItem } from '@onekeyhq/engine/src/managers/notification';
import {
  IMPL_APTOS,
  IMPL_EVM,
  IMPL_SUI,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { useCopyAddress } from '../../hooks/useCopyAddress';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import {
  useAddressCanSubscribe,
  useEnabledAccountDynamicAccounts,
} from '../PushNotification/hooks';

import BaseMenu from './BaseMenu';

import type { IMenu } from './BaseMenu';
import type { MessageDescriptor } from 'react-intl';

const NeedActivateAccountImpl = [IMPL_APTOS, IMPL_SUI];

const AccountMoreMenu: FC<IMenu> = (props) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { network, account, wallet } = useActiveWalletAccount();
  const { copyAddress } = useCopyAddress({ wallet });
  const { serviceNotification, dispatch } = backgroundApiProxy;
  const { enabledAccounts, loading, refresh } =
    useEnabledAccountDynamicAccounts();
  const [needActivateAccount, setNeedActivateAccount] =
    useState<boolean>(false);

  const enabledNotification = useMemo(
    () =>
      enabledAccounts.find(
        (a) => a.address.toLowerCase() === account?.address?.toLowerCase?.(),
      ),
    [enabledAccounts, account],
  );

  const addressCanSubscribe = useAddressCanSubscribe(account);

  useEffect(() => {
    (async () => {
      if (!network) return false;

      const vaultSettings = await backgroundApiProxy.engine.getVaultSettings(
        network.id,
      );
      // temp
      if (
        NeedActivateAccountImpl.includes(network.impl) &&
        !network.isTestnet
      ) {
        return false;
      }
      setNeedActivateAccount(
        !!vaultSettings?.activateAccountRequired && wallet?.type !== 'watching',
      );
    })();
  }, [network, wallet?.type]);

  const showSubscriptionIcon =
    !!account &&
    !loading &&
    addressCanSubscribe &&
    enabledAccountDynamicNetworkIds.includes(network?.id || '') &&
    isCoinTypeCompatibleWithImpl(account.coinType, IMPL_EVM);

  const accountSubscriptionIcon = useMemo(
    () => (enabledNotification ? 'BellSlashMini' : 'BellMini'),
    [enabledNotification],
  );

  const onChangeAccountSubscribe = useCallback(async () => {
    if (!account) {
      return;
    }
    let res: AccountDynamicItem | null = null;
    if (enabledNotification) {
      res = await serviceNotification.removeAccountDynamic({
        address: account.address,
      });
    } else {
      dispatch(
        setPushNotificationConfig({
          pushEnable: true,
          accountActivityPushEnable: true,
        }),
      );
      res = await serviceNotification.addAccountDynamic({
        accountId: account.id,
        address: account.address,
        name: account.name,
        passphrase: !!wallet && isPassphraseWallet(wallet),
      });
    }
    if (!res) {
      return;
    }
    toast.show({
      title: intl.formatMessage({
        id: enabledNotification
          ? 'msg__unsubscription_succeeded'
          : 'msg__subscription_succeeded',
      }),
    });
  }, [
    wallet,
    account,
    intl,
    toast,
    dispatch,
    enabledNotification,
    serviceNotification,
  ]);

  const walletType = wallet?.type;
  const options: (
    | {
        id: MessageDescriptor['id'];
        onPress: () => void;
        icon: ICON_NAMES;
      }
    | false
    | undefined
  )[] = useMemo(
    () => [
      !!needActivateAccount && {
        id: 'action__get_faucet',
        onPress: () => {
          if (!account) return;
          if (!network) return;

          backgroundApiProxy.engine
            .activateAccount(account.id, network.id)
            .catch(() => {});
        },
        icon: 'LightBulbMini',
      },
      // TODO Connected Sites
      walletType !== 'watching' && {
        id: 'action__buy_crypto',
        onPress: () => {
          if (!account) return;
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayRoutes.SupportTokenListModal,
              params: {
                networkId: network?.id ?? '',
              },
            },
          });
        },
        icon: 'PlusMini',
      },
      walletType !== 'watching' && {
        id: 'action__sell_crypto',
        onPress: () => {
          if (!account) return;
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayRoutes.SupportTokenListModal,
              params: {
                networkId: network?.id ?? '',
                type: 'Sell',
              },
            },
          });
        },
        icon: 'BanknotesMini',
      },
      {
        id: 'action__copy_address',
        onPress: () => {
          setTimeout(() => {
            copyAddress(account?.address);
          });
        },
        icon: 'Square2StackMini',
      },
      showSubscriptionIcon && {
        id: enabledNotification ? 'action__unsubscribe' : 'action__subscribe',
        onPress: onChangeAccountSubscribe,
        icon: accountSubscriptionIcon,
      },
      // TODO Share
    ],
    [
      needActivateAccount,
      walletType,
      showSubscriptionIcon,
      enabledNotification,
      onChangeAccountSubscribe,
      accountSubscriptionIcon,
      account,
      network,
      navigation,
      copyAddress,
    ],
  );
  return <BaseMenu options={options} {...props} onOpen={refresh} />;
};

export default AccountMoreMenu;
