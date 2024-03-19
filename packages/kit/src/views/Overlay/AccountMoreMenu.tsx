import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAsync } from 'react-async-hook';
import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  IconButton,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { AccountDynamicItem } from '@onekeyhq/engine/src/managers/notification';
import {
  IMPL_APTOS,
  IMPL_EVM,
  IMPL_SUI,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  isHardwareWallet,
  isHdWallet,
  isPassphraseWallet,
} from '@onekeyhq/shared/src/engine/engineUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { useCopyAddress } from '../../hooks/useCopyAddress';
import { useIsMounted } from '../../hooks/useIsMounted';
import useOpenBlockBrowser from '../../hooks/useOpenBlockBrowser';
import { useIsDevModeEnabled } from '../../hooks/useSettingsDevMode';
import {
  CoinControlModalRoutes,
  ModalRoutes,
  NostrModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import { GasPanelRoutes } from '../GasPanel/types';
import {
  checkAccountCanSubscribe,
  useEnabledAccountDynamicAccounts,
} from '../PushNotification/hooks';
import { useFiatPay } from '../Wallet/AccountInfo/hooks';

import BaseMenu from './BaseMenu';

import type { MessageDescriptor } from 'react-intl';

const NeedActivateAccountImpl = [IMPL_APTOS, IMPL_SUI];

interface Props {
  iconBoxFlex: number;
  isSmallView: boolean;
}

const AccountMoreMenu: FC<Props> = ({ iconBoxFlex, isSmallView }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network, account, wallet, walletId, accountId, networkId } =
    useActiveWalletAccount();
  const { openAddressDetails } = useOpenBlockBrowser(network);
  const { copyAddress } = useCopyAddress({ wallet });
  const { serviceNotification, dispatch } = backgroundApiProxy;
  const { enabledAccounts, loading, refresh } =
    useEnabledAccountDynamicAccounts(false);
  const [needActivateAccount, setNeedActivateAccount] =
    useState<boolean>(false);
  const isMounted = useIsMounted();
  const isDevMode = useIsDevModeEnabled();

  const enabledNotification = useMemo(
    () =>
      enabledAccounts.find(
        (a) => a.address.toLowerCase() === account?.address?.toLowerCase?.(),
      ),
    [enabledAccounts, account],
  );

  const { result: addressCanSubscribe = false, execute } = useAsync(
    async () => checkAccountCanSubscribe(account, network?.id ?? ''),
    [account],
    {
      executeOnMount: false,
      executeOnUpdate: false,
    },
  );

  useEffect(() => {
    (async () => {
      if (!network) return false;

      if (isAllNetworks(network?.id)) {
        return false;
      }

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

  const showCoinControl = network?.settings.isBtcForkChain && !!account?.xpub;

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
          isSelectMode: false,
        },
      },
    });
  }, [navigation, network?.id, accountId]);

  const buy = useFiatPay({
    accountId,
    networkId,
    type: 'buy',
  });

  const sell = useFiatPay({
    accountId,
    networkId,
    type: 'sell',
  });

  const displayNostrOption = useMemo(
    () => isHdWallet({ walletId }) || isHardwareWallet({ walletId }),
    [walletId],
  );

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
      buy.visible && {
        id: 'action__buy_crypto',
        onPress: buy.process,
        icon: 'PlusMini',
      },
      sell.visible && {
        id: 'action__sell_crypto',
        onPress: sell.process,
        icon: 'BanknotesMini',
      },
      !!account?.address && {
        id: 'action__view_in_explorer',
        icon: 'GlobeAltMini',
        onPress: () => {
          openAddressDetails(account?.address);
        },
      },
      !isAllNetworks(network?.id) &&
        !!account?.address && {
          id: 'action__copy_address',
          onPress: () => {
            setTimeout(() => {
              copyAddress({
                address: account?.address,
                displayAddress: account?.displayAddress,
              });
            }, 150);
          },
          icon: 'Square2StackMini',
        },
      showSubscriptionIcon && {
        id: enabledNotification ? 'action__unsubscribe' : 'action__subscribe',
        onPress: onChangeAccountSubscribe,
        icon: accountSubscriptionIcon,
      },
      showCoinControl && {
        id: 'title__manage_utxos',
        onPress: onPressCoinControl,
        icon: 'CircleStackOutline',
      },
      isDevMode && {
        id: 'content__gas_fee',
        onPress: () => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.GasPanel,
            params: {
              screen: GasPanelRoutes.GasPanelModal,
              params: {
                networkId: network?.id ?? '',
              },
            },
          });
        },
        icon: 'GasIllus',
      },
      displayNostrOption && {
        id: 'title__nostr',
        onPress: () => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Nostr,
            params: {
              screen: NostrModalRoutes.ExportPubkey,
              params: {
                walletId,
                networkId: network?.id ?? '',
                accountId: account?.id ?? '',
              },
            },
          });
        },
        icon: 'NostrMini',
      },
      // TODO Share
    ],
    [
      buy,
      sell,
      needActivateAccount,
      showSubscriptionIcon,
      enabledNotification,
      onChangeAccountSubscribe,
      accountSubscriptionIcon,
      showCoinControl,
      onPressCoinControl,
      isDevMode,
      account,
      network,
      walletId,
      navigation,
      copyAddress,
      openAddressDetails,
      displayNostrOption,
    ],
  );

  if (!options.filter(Boolean)?.length) {
    return null;
  }

  return (
    <Box flex={iconBoxFlex} mx={3} minW="56px" alignItems="center">
      <BaseMenu
        w={220}
        options={options}
        onOpen={() => {
          refresh();
          execute();
        }}
      >
        <IconButton
          circle
          size={isSmallView ? 'xl' : 'lg'}
          name="EllipsisVerticalOutline"
          type="basic"
        />
      </BaseMenu>
      <Typography.CaptionStrong
        textAlign="center"
        mt="8px"
        color="text-default"
      >
        {intl.formatMessage({ id: 'action__more' })}
      </Typography.CaptionStrong>
    </Box>
  );
};

export default AccountMoreMenu;
