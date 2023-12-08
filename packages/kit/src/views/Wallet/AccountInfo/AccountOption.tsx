import type { FC } from 'react';
import { memo, useCallback } from 'react';

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
import LNSwapMenu from '@onekeyhq/kit/src/views/LightningNetwork/components/LNSwapMenu';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  isBTCNetwork,
  isLightningNetworkByImpl,
  isLightningNetworkByNetworkId,
} from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useNavigation,
  useNavigationActions,
  useNetwork,
} from '../../../hooks';
import { useShouldHideInscriptions } from '../../../hooks/crossHooks/useShouldHideInscriptions';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import { ModalRoutes, RootRoutes, TabRoutes } from '../../../routes/routesEnum';
import AccountMoreMenu from '../../Overlay/AccountMoreMenu';
import { AccountReceiveMenu } from '../../Overlay/AccountReceiveMenu';
import { ReceiveTokenModalRoutes } from '../../ReceiveToken/types';

type AccountOptionProps = { isSmallView: boolean };

const AccountOption: FC<AccountOptionProps> = memo(
  ({ isSmallView }: AccountOptionProps) => {
    const intl = useIntl();
    const navigation = useNavigation();
    const { wallet, account, networkId, accountId } = useActiveWalletAccount();
    const isVertical = useIsVerticalLayout();
    const { sendToken } = useNavigationActions();
    const iconBoxFlex = isVertical ? 1 : 0;
    const { network } = useNetwork({ networkId });

    const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
      networkId,
      accountId,
      filter: ({ network: n, account: a }) => !!n && !!a,
    });
    const shouldHideInscriptions = useShouldHideInscriptions({
      accountId,
      networkId,
    });

    const onSendToken = useCallback(() => {
      selectNetworkAccount().then(({ network: n, account: a }) => {
        if (!n || !a) {
          return;
        }
        sendToken({ accountId: a?.id, networkId: n?.id });
      });
    }, [sendToken, selectNetworkAccount]);

    const onReceive = useCallback(
      (receiveInscription?: boolean) => {
        selectNetworkAccount().then(({ network: n, account: a }) => {
          if (!n || !a) {
            return;
          }
          if (isLightningNetworkByImpl(n?.impl)) {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Receive,
              params: {
                screen: ReceiveTokenModalRoutes.CreateInvoice,
                params: {
                  networkId: n.id,
                  accountId: a?.id,
                },
              },
            });
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
                receiveInscription,
              },
            },
          });
        });
      },
      [navigation, wallet, selectNetworkAccount],
    );

    const onSwap = useCallback(() => {
      selectNetworkAccount().then(async ({ network: n, account: a }) => {
        if (!n || !a) {
          return;
        }
        let token = await backgroundApiProxy.engine.getNativeTokenInfo(
          n?.id ?? '',
        );
        if (token) {
          const supported =
            await backgroundApiProxy.serviceSwap.tokenIsSupported(token);
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
          const isLightningNetwork = isLightningNetworkByNetworkId(n.id);
          backgroundApiProxy.serviceSwap
            .sellToken(token, !isLightningNetwork)
            .then(() => {
              // Switch to LN to BTC swap if is lightning network
              if (isLightningNetwork) {
                backgroundApiProxy.serviceSwap.switchToNativeOutputToken(
                  n.id === OnekeyNetwork.lightning
                    ? OnekeyNetwork.btc
                    : OnekeyNetwork.tbtc,
                );
              }
            });
          if (a) {
            backgroundApiProxy.serviceSwap.setSendingAccountSimple(a);
            const paymentToken =
              await backgroundApiProxy.serviceSwap.getPaymentToken(token);
            if (paymentToken?.networkId === n?.id) {
              backgroundApiProxy.serviceSwap.setRecipientToAccount(a, n);
            }
          }
        }
        navigation.getParent()?.navigate(TabRoutes.Swap);
      });
    }, [navigation, intl, selectNetworkAccount]);

    const renderReceiveOption = useCallback(() => {
      if (isBTCNetwork(networkId) && !shouldHideInscriptions) {
        return (
          <AccountReceiveMenu
            address={account?.address ?? ''}
            onReceive={onReceive}
            isSmallView={isSmallView}
            iconBoxFlex={iconBoxFlex}
          />
        );
      }

      return (
        <Pressable
          flex={iconBoxFlex}
          mx={3}
          minW="56px"
          alignItems="center"
          isDisabled={wallet?.type === 'watching' || !account}
          onPress={() => onReceive()}
        >
          <TouchableWithoutFeedback>
            <IconButton
              circle
              size={isSmallView ? 'xl' : 'lg'}
              name="QrCodeOutline"
              type="basic"
              isDisabled={wallet?.type === 'watching' || !account}
              onPress={() => onReceive()}
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
      );
    }, [
      account,
      iconBoxFlex,
      intl,
      isSmallView,
      networkId,
      onReceive,
      shouldHideInscriptions,
      wallet?.type,
    ]);

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
        {renderReceiveOption()}
        {network?.settings.customAccountInfoSwapOption ? (
          <LNSwapMenu
            isSmallView={isSmallView}
            networkId={networkId}
            accountId={accountId}
          />
        ) : (
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
        )}

        {network?.settings.hiddenAccountInfoMoreOption ? null : (
          <AccountMoreMenu
            isSmallView={isSmallView}
            iconBoxFlex={iconBoxFlex}
          />
        )}
      </Box>
    );
  },
);

AccountOption.displayName = 'AccountOption';
export default AccountOption;
