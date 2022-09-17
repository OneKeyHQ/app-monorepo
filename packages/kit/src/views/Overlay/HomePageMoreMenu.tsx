import { FC, useCallback, useMemo } from 'react';

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
  IMPL_EVM,
  enabledAccountDynamicNetworkIds,
} from '@onekeyhq/engine/src/constants';
import { isPassphraseWallet } from '@onekeyhq/engine/src/engineUtils';
import { isCoinTypeCompatibleWithImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountDynamicItem } from '@onekeyhq/engine/src/managers/notification';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { useCopyAddress } from '../../hooks/useCopyAddress';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setPushNotificationConfig } from '../../store/reducers/settings';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';
import { showOverlay } from '../../utils/overlayUtils';
import { useEnabledAccountDynamicAccounts } from '../PushNotification/hooks';

import { OverlayPanel } from './OverlayPanel';

const MoreSettings: FC<{ closeOverlay: () => void }> = ({ closeOverlay }) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { network, account, wallet } = useActiveWalletAccount();
  const { copyAddress } = useCopyAddress({ wallet });
  const { serviceNotification, dispatch } = backgroundApiProxy;
  const isVerticalLayout = useIsVerticalLayout();
  const { enabledAccounts, loading } = useEnabledAccountDynamicAccounts();

  const enabledNotification = useMemo(
    () =>
      enabledAccounts.find(
        (a) => a.address.toLowerCase() === account?.address?.toLowerCase?.(),
      ),
    [enabledAccounts, account],
  );

  const showSubscriptionIcon =
    !!account &&
    platformEnv.isNative &&
    !loading &&
    enabledAccountDynamicNetworkIds.includes(network?.id || '') &&
    isCoinTypeCompatibleWithImpl(account.coinType, IMPL_EVM);

  const accountSubscriptionIcon = useMemo(() => {
    if (isVerticalLayout) {
      return enabledNotification ? 'BellOffOutline' : 'BellOutline';
    }
    return enabledNotification ? 'BellOffSolid' : 'BellSolid';
  }, [isVerticalLayout, enabledNotification]);

  // https://www.figma.com/file/vKm9jnpi3gfoJxZsoqH8Q2?node-id=489:30375#244559862
  const disableScan = platformEnv.isWeb && !isVerticalLayout;

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
      !disableScan && {
        id: 'action__scan',
        onPress: () => gotoScanQrcode(),
        icon: 'ScanSolid',
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
        icon: isVerticalLayout ? 'PlusOutline' : 'PlusSolid',
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
        icon: isVerticalLayout ? 'CashOutline' : 'CashSolid',
      },
      platformEnv.isExtensionUiPopup && {
        id: 'form__expand_view',
        onPress: () => {
          backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: '',
          });
        },
        icon: 'ArrowsExpandOutline',
      },
      {
        id: 'action__copy_address',
        onPress: () => {
          setTimeout(() => {
            copyAddress(account?.address);
          });
        },
        icon: isVerticalLayout ? 'DuplicateOutline' : 'DuplicateSolid',
      },
      showSubscriptionIcon && {
        id: enabledNotification ? 'action__unsubscribe' : 'action__subscribe',
        onPress: onChangeAccountSubscribe,
        icon: accountSubscriptionIcon,
      },
      // TODO Share
    ],
    [
      showSubscriptionIcon,
      accountSubscriptionIcon,
      onChangeAccountSubscribe,
      enabledNotification,
      disableScan,
      walletType,
      isVerticalLayout,
      account,
      navigation,
      network?.id,
      copyAddress,
    ],
  );
  return (
    <Box bg="surface-subdued" flexDirection="column">
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

// @ts-ignore
export const showHomePageMoreMenu = (triggerEle?: SelectProps['triggerEle']) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={{
        header: formatMessage({ id: 'action__more' }),
      }}
    >
      <MoreSettings closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
