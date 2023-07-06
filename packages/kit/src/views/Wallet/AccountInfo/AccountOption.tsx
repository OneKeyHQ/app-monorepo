import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { TouchableWithoutFeedback } from 'react-native';

import {
  Box,
  IconButton,
  Pressable,
  ToastManager,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useNavigation,
  useNavigationActions,
} from '../../../hooks';
import { ModalRoutes, RootRoutes, TabRoutes } from '../../../routes/routesEnum';
import { useAllNetworksSelectNetworkAccount } from '../../ManageNetworks/hooks';
import AccountMoreMenu from '../../Overlay/AccountMoreMenu';
import { ReceiveTokenModalRoutes } from '../../ReceiveToken/types';

type AccountOptionProps = { isSmallView: boolean };

export const AccountOption: FC<AccountOptionProps> = ({ isSmallView }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { wallet, account, network, walletId, networkId, accountId } =
    useActiveWalletAccount();
  const isVertical = useIsVerticalLayout();
  const { sendToken } = useNavigationActions();
  const iconBoxFlex = isVertical ? 1 : 0;

  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    networkId,
    walletId,
    accountId,
    filter: () => true,
  });

  const onSendToken = useCallback(() => {
    selectNetworkAccount().then(({ network: n, account: a }) => {
      if (!n || !a) {
        sendToken({ accountId: a?.id, networkId: n?.id });
      }
    });
  }, [sendToken, selectNetworkAccount]);

  const onReceive = useCallback(() => {
    selectNetworkAccount().then(({ network: n, account: a }) => {
      if (!n || !a) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Receive,
        params: {
          screen: ReceiveTokenModalRoutes.ReceiveToken,
          params: {
            address: a.address,
            displayAddress: a.displayAddress,
            wallet,
            network: n,
            account: a,
            template: a.template,
          },
        },
      });
    });
  }, [navigation, wallet, selectNetworkAccount]);

  const onSwap = useCallback(async () => {
    let token = await backgroundApiProxy.engine.getNativeTokenInfo(
      network?.id ?? '',
    );
    if (token) {
      const supported = await backgroundApiProxy.serviceSwap.tokenIsSupported(
        token,
      );
      if (!supported) {
        ToastManager.show(
          {
            title: intl.formatMessage({ id: 'msg__wrong_network_desc' }),
          },
          { type: 'default' },
        );
        token = await backgroundApiProxy.engine.getNativeTokenInfo(
          OnekeyNetwork.eth,
        );
      }
    }
    if (token) {
      backgroundApiProxy.serviceSwap.sellToken(token);
      if (account) {
        backgroundApiProxy.serviceSwap.setSendingAccountSimple(account);
        const paymentToken =
          await backgroundApiProxy.serviceSwap.getPaymentToken(token);
        if (paymentToken?.networkId === network?.id) {
          backgroundApiProxy.serviceSwap.setRecipientToAccount(
            account,
            network,
          );
        }
      }
    }
    navigation.getParent()?.navigate(TabRoutes.Swap);
  }, [network, account, navigation, intl]);

  return (
    <Box flexDirection="row" px={isVertical ? 1 : 0} mx={-3}>
      <Pressable
        flex={iconBoxFlex}
        mx={3}
        minW="56px"
        alignItems="center"
        isDisabled={wallet?.type === 'watching' || !account}
        onPress={onSendToken}
      >
        <TouchableWithoutFeedback>
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="PaperAirplaneOutline"
            type="basic"
            isDisabled={wallet?.type === 'watching' || !account}
            onPress={onSendToken}
          />
        </TouchableWithoutFeedback>
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={
            wallet?.type === 'watching' || !account
              ? 'text-disabled'
              : 'text-default'
          }
        >
          {intl.formatMessage({ id: 'action__send' })}
        </Typography.CaptionStrong>
      </Pressable>
      <Pressable
        flex={iconBoxFlex}
        mx={3}
        minW="56px"
        alignItems="center"
        isDisabled={wallet?.type === 'watching' || !account}
        onPress={onReceive}
      >
        <TouchableWithoutFeedback>
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="QrCodeOutline"
            type="basic"
            isDisabled={wallet?.type === 'watching' || !account}
            onPress={onReceive}
          />
        </TouchableWithoutFeedback>
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={
            wallet?.type === 'watching' || !account
              ? 'text-disabled'
              : 'text-default'
          }
        >
          {intl.formatMessage({ id: 'action__receive' })}
        </Typography.CaptionStrong>
      </Pressable>
      <Pressable
        flex={iconBoxFlex}
        mx={3}
        minW="56px"
        alignItems="center"
        isDisabled={wallet?.type === 'watching' || !account}
        onPress={onSwap}
      >
        <TouchableWithoutFeedback>
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="ArrowsRightLeftOutline"
            type="basic"
            isDisabled={wallet?.type === 'watching' || !account}
            onPress={onSwap}
          />
        </TouchableWithoutFeedback>
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={
            wallet?.type === 'watching' || !account
              ? 'text-disabled'
              : 'text-default'
          }
        >
          {intl.formatMessage({ id: 'title__swap' })}
        </Typography.CaptionStrong>
      </Pressable>

      <Box flex={iconBoxFlex} mx={3} minW="56px" alignItems="center">
        <AccountMoreMenu>
          <IconButton
            circle
            size={isSmallView ? 'xl' : 'lg'}
            name="EllipsisVerticalOutline"
            type="basic"
          />
        </AccountMoreMenu>
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color="text-default"
        >
          {intl.formatMessage({ id: 'action__more' })}
        </Typography.CaptionStrong>
      </Box>
    </Box>
  );
};
