import { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { MessageDescriptor, useIntl } from 'react-intl';

import {
  Box,
  ICON_NAMES,
  Icon,
  Text,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import { SelectProps } from '@onekeyhq/components/src/Select';
import {
  IMPL_APTOS,
  IMPL_EVM,
  IMPL_SUI,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/engine/src/constants';
import { isPassphraseWallet } from '@onekeyhq/engine/src/engineUtils';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountDynamicItem } from '@onekeyhq/engine/src/managers/notification';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { useCopyAddress } from '../../hooks/useCopyAddress';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';
import { useEnabledAccountDynamicAccounts } from '../PushNotification/hooks';

import { OverlayPanel } from './OverlayPanel';

const NeedActivateAccountImpl = [IMPL_APTOS, IMPL_SUI];

const AccountMoreSettings: FC<{ closeOverlay: () => void }> = ({
  closeOverlay,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { network, account, wallet } = useActiveWalletAccount();
  const { copyAddress } = useCopyAddress({ wallet });
  const { serviceNotification, dispatch } = backgroundApiProxy;
  const isVerticalLayout = useIsVerticalLayout();
  const { enabledAccounts, loading } = useEnabledAccountDynamicAccounts();
  const [needActivateAccount, setNeedActivateAccount] =
    useState<boolean>(false);

  const enabledNotification = useMemo(
    () =>
      enabledAccounts.find(
        (a) => a.address.toLowerCase() === account?.address?.toLowerCase?.(),
      ),
    [enabledAccounts, account],
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
      setNeedActivateAccount(
        !!vaultSettings?.activateAccountRequired && wallet?.type !== 'watching',
      );
    })();
  }, [network, wallet?.type]);

  const showSubscriptionIcon =
    !!account &&
    !loading &&
    enabledAccountDynamicNetworkIds.includes(network?.id || '') &&
    isCoinTypeCompatibleWithImpl(account.coinType, IMPL_EVM);

  const accountSubscriptionIcon = useMemo(() => {
    if (isVerticalLayout) {
      return enabledNotification ? 'BellSlashOutline' : 'BellOutline';
    }
    return enabledNotification ? 'BellSlashMini' : 'BellMini';
  }, [isVerticalLayout, enabledNotification]);

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
        icon: isVerticalLayout ? 'LightBulbOutline' : 'LightBulbMini',
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
        icon: isVerticalLayout ? 'PlusOutline' : 'PlusMini',
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
        icon: isVerticalLayout ? 'BanknotesOutline' : 'BanknotesMini',
      },
      {
        id: 'action__copy_address',
        onPress: () => {
          setTimeout(() => {
            copyAddress(account?.address);
          });
        },
        icon: isVerticalLayout ? 'Square2StackOutline' : 'Square2StackMini',
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
      isVerticalLayout,
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
  return (
    <Box flexDirection="column">
      {options.filter(Boolean).map(({ onPress, icon, id }) => (
        <PressableItem
          key={id}
          flexDirection="row"
          alignItems="center"
          py={{ base: '12px', sm: '8px' }}
          px={{ base: '16px', sm: '8px' }}
          bg="transparent"
          borderRadius="12px"
          onPress={() => {
            closeOverlay();
            onPress();
          }}
        >
          <Icon size={isVerticalLayout ? 24 : 20} name={icon} />
          <Text
            typography={isVerticalLayout ? 'Body1Strong' : 'Body2Strong'}
            ml="12px"
          >
            {intl.formatMessage({
              id,
            })}
          </Text>
        </PressableItem>
      ))}
    </Box>
  );
};

export const showAccountMoreMenu = (triggerEle?: SelectProps['triggerEle']) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={{
        header: formatMessage({ id: 'action__more' }),
      }}
    >
      <AccountMoreSettings closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
