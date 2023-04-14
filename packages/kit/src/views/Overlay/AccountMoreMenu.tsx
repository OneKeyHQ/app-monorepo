import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { capitalize } from 'lodash';
import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { ToastManager } from '@onekeyhq/components';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import type { AccountDynamicItem } from '@onekeyhq/engine/src/managers/notification';
import {
  IMPL_APTOS,
  IMPL_EVM,
  IMPL_SUI,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { useCopyAddress } from '../../hooks/useCopyAddress';
import { useIsMounted } from '../../hooks/useIsMounted';
import { buildAddressDetailsUrl } from '../../hooks/useOpenBlockBrowser';
import {
  CoinControlModalRoutes,
  FiatPayModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import { openUrl } from '../../utils/openUrl';
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
  const navigation = useNavigation();
  const { network, account, wallet, accountId } = useActiveWalletAccount();
  const { copyAddress } = useCopyAddress({ wallet });
  const { serviceNotification, dispatch } = backgroundApiProxy;
  const { enabledAccounts, loading, refresh } =
    useEnabledAccountDynamicAccounts();
  const [needActivateAccount, setNeedActivateAccount] =
    useState<boolean>(false);
  const isMounted = useIsMounted();

  const enabledNotification = useMemo(
    () =>
      enabledAccounts.find(
        (a) => a.address.toLowerCase() === account?.address?.toLowerCase?.(),
      ),
    [enabledAccounts, account],
  );

  const addressCanSubscribe = useAddressCanSubscribe(
    account,
    network?.id ?? '',
  );

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
      if (isMounted.current) {
        setNeedActivateAccount(
          !!vaultSettings?.activateAccountRequired &&
            wallet?.type !== 'watching',
        );
      }
    })();
  }, [isMounted, network, wallet?.type]);

  const showSubscriptionIcon =
    !!account &&
    !loading &&
    addressCanSubscribe &&
    enabledAccountDynamicNetworkIds.includes(network?.id || '') &&
    isCoinTypeCompatibleWithImpl(account.coinType, IMPL_EVM);

  const showCoinControl = network?.settings.isBtcForkChain;

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
    ToastManager.show({
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
    dispatch,
    enabledNotification,
    serviceNotification,
  ]);

  const onPressCoinControl = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CoinControl,
      params: {
        screen: CoinControlModalRoutes.CoinControlModal,
        params: {
          networkId: network?.id ?? '',
          accountId,
        },
      },
    });
  }, [navigation, network?.id, accountId]);

  const walletType = wallet?.type;

  const explorerUrl = buildAddressDetailsUrl(network, account?.address);
  const explorerName = useMemo(() => {
    try {
      const hostnameArray = new URL(explorerUrl).hostname.split('.');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return capitalize(hostnameArray.at(-2));
    } catch (e) {
      return 'Explorer';
    }
  }, [explorerUrl]);
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
      walletType !== 'watching' &&
        !platformEnv.isAppleStoreEnv && {
          id: 'action__buy_crypto',
          onPress: () => {
            if (!account) return;
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.FiatPay,
              params: {
                screen: FiatPayModalRoutes.SupportTokenListModal,
                params: {
                  networkId: network?.id ?? '',
                  accountId,
                  type: 'buy',
                },
              },
            });
          },
          icon: 'PlusMini',
        },
      walletType !== 'watching' &&
        !platformEnv.isAppleStoreEnv && {
          id: 'action__sell_crypto',
          onPress: () => {
            if (!account) return;
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.FiatPay,
              params: {
                screen: FiatPayModalRoutes.SupportTokenListModal,
                params: {
                  networkId: network?.id ?? '',
                  type: 'sell',
                  accountId,
                },
              },
            });
          },
          icon: 'BanknotesMini',
        },
      !!explorerUrl && {
        id: 'action__view_on_somewhere',
        intlValues: {
          where: explorerName,
        },
        icon: 'GlobeAltMini',
        onPress: () => {
          openUrl(explorerUrl, explorerName, {
            modalMode: true,
          });
        },
      },
      {
        id: 'action__copy_address',
        onPress: () => {
          setTimeout(() => {
            copyAddress({
              address: account?.address,
              displayAddress: account?.displayAddress,
            });
          });
        },
        icon: 'Square2StackMini',
      },
      showSubscriptionIcon && {
        id: enabledNotification ? 'action__unsubscribe' : 'action__subscribe',
        onPress: onChangeAccountSubscribe,
        icon: accountSubscriptionIcon,
      },
      showCoinControl && {
        id: 'action__coin_control',
        onPress: onPressCoinControl,
        icon: 'DocumentTextOutline',
      },
      // TODO Share
    ],
    [
      needActivateAccount,
      walletType,
      explorerUrl,
      explorerName,
      showSubscriptionIcon,
      showCoinControl,
      enabledNotification,
      onChangeAccountSubscribe,
      onPressCoinControl,
      accountSubscriptionIcon,
      account,
      network,
      navigation,
      accountId,
      copyAddress,
    ],
  );
  return <BaseMenu w={220} options={options} {...props} onOpen={refresh} />;
};

export default AccountMoreMenu;
