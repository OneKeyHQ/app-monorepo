import type { FC } from 'react';
import { useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { TouchableWithoutFeedback } from 'react-native';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  HStack,
  Icon,
  IconButton,
  Pressable,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation, useWallet } from '../../../hooks';
import {
  FiatPayModalRoutes,
  MainRoutes,
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  TabRoutes,
} from '../../../routes/routesEnum';
import { useAllNetworksSelectNetworkAccount } from '../../ManageNetworks/hooks';
import BaseMenu from '../../Overlay/BaseMenu';
import { SendModalRoutes } from '../../Send/enums';
import {
  ETHRelatedPoolShowControl,
  EthTopAprShowControl,
} from '../../Staking/components/StakingEthOptions';
import { TokenDetailContext } from '../context';

import type { MessageDescriptor } from 'react-intl';

type ISingleChainInfo = {
  network: Network;
  account: Account;
  token: TokenType;
};

type IButtonItem = {
  id: MessageDescriptor['id'];
  onPress: (params: ISingleChainInfo) => unknown;
  icon: ICON_NAMES;
  visible?: () => boolean;
};

const ButtonItem = ({
  icon,
  text,
  onPress,
  isDisabled,
}: {
  icon: ICON_NAMES;
  text: string;
  onPress?: () => unknown;
  isDisabled?: boolean;
}) => {
  const isVertical = useIsVerticalLayout();
  const content = useMemo(() => {
    let ele = (
      <Box mx={isVertical ? 0 : 3}>
        {typeof onPress === 'function' ? (
          <TouchableWithoutFeedback>
            <IconButton
              circle
              size={isVertical ? 'lg' : 'sm'}
              name={icon}
              type="basic"
              isDisabled={isDisabled}
              onPress={onPress}
            />
          </TouchableWithoutFeedback>
        ) : (
          <Box
            p={isVertical ? 2 : 1.5}
            alignItems="center"
            justifyContent="center"
            borderWidth="1px"
            borderRadius="999px"
            borderColor="border-default"
            bg="action-secondary-default"
          >
            <Icon name={icon} size={isVertical ? 24 : 20} />
          </Box>
        )}
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={isDisabled ? 'text-disabled' : 'text-default'}
        >
          {text}
        </Typography.CaptionStrong>
      </Box>
    );

    if (typeof onPress === 'function') {
      ele = <Pressable onPress={onPress}>{ele}</Pressable>;
    }

    return ele;
  }, [icon, isVertical, text, onPress, isDisabled]);

  return content;
};

export const ButtonsSection: FC = () => {
  const intl = useIntl();

  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation();
  const context = useContext(TokenDetailContext);
  const {
    walletId = '',
    accountId = '',
    networkId = '',
    sendAddress,
    symbol,
    logoURI,
  } = context?.routeParams ?? {};

  const { items } = context?.positionInfo ?? {};

  const { tokens, loading, ethereumNativeToken } = context?.detailInfo ?? {};

  const { wallet } = useWallet({
    walletId,
  });

  const filter = useCallback(
    ({ network }: { network?: Network | null }) =>
      !!network?.id && !!items?.some((t) => t.networkId === network?.id),
    [items],
  );

  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    networkId,
    walletId,
    accountId,
    filter,
  });

  const onSend = useCallback(
    ({ network, account, token }: ISingleChainInfo) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.PreSendAddress,
          params: {
            accountId: account.id,
            networkId: network.id,
            from: '',
            to: '',
            amount: '',
            token: token?.address,
            tokenSendAddress: token?.sendAddress,
          },
        },
      });
    },
    [navigation],
  );

  const onReceive = useCallback(
    ({ network, account }: ISingleChainInfo) => {
      if (!wallet) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Receive,
        params: {
          screen: ReceiveTokenModalRoutes.ReceiveToken,
          params: {
            address: account.address,
            displayAddress: account.displayAddress,
            wallet,
            network,
            account,
            template: account.template,
          },
        },
      });
    },
    [navigation, wallet],
  );

  const onSwap = useCallback(
    ({ token }: ISingleChainInfo) => {
      backgroundApiProxy.serviceSwap.buyToken(token);
      navigation.navigate(RootRoutes.Main, {
        screen: MainRoutes.Tab,
        params: {
          screen: TabRoutes.Swap,
        },
      });
    },
    [navigation],
  );

  const goToWebView = useCallback(
    (signedUrl: string) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.FiatPay,
        params: {
          screen: FiatPayModalRoutes.MoonpayWebViewModal,
          params: {
            url: signedUrl,
          },
        },
      });
    },
    [navigation],
  );

  const onBuy = useCallback(
    async ({ token, account, network }: ISingleChainInfo) => {
      const signedUrl = await backgroundApiProxy.serviceFiatPay.getFiatPayUrl({
        type: 'buy',
        address: account?.address,
        tokenAddress: token?.address,
        networkId: network?.id,
      });
      goToWebView(signedUrl);
    },
    [goToWebView],
  );

  const onSell = useCallback(
    async ({ account, network, token }: ISingleChainInfo) => {
      const signedUrl = await backgroundApiProxy.serviceFiatPay.getFiatPayUrl({
        type: 'buy',
        address: account?.address,
        tokenAddress: token?.address,
        networkId: network?.id,
      });
      goToWebView(signedUrl);
    },
    [goToWebView],
  );

  const handlePress = useCallback(
    (item: IButtonItem) => {
      selectNetworkAccount().then(({ network, account }) => {
        const token = tokens?.find((t) => {
          const networksMatch =
            network?.id === `${t.impl ?? ''}--${t.chainId ?? ''}`;
          if (!sendAddress) {
            return networksMatch;
          }
          return networksMatch && sendAddress === t.sendAddress;
        });
        if (token) {
          item.onPress?.({
            network,
            account,
            token,
          });
        }
      });
    },
    [selectNetworkAccount, tokens, sendAddress],
  );

  const { buttons, options } = useMemo(() => {
    const list: IButtonItem[] = [
      {
        id: 'action__send',
        onPress: onSend,
        icon: 'PaperAirplaneOutline',
      },
      {
        id: 'action__receive',
        onPress: onReceive,
        icon: 'QrCodeMini',
      },
      {
        id: 'title__swap',
        onPress: onSwap,
        icon: 'ArrowsRightLeftSolid',
        visible: () => isVerticalLayout,
      },
      {
        id: 'action__buy',
        onPress: onBuy,
        icon: 'PlusMini',
      },
      {
        id: 'action__sell',
        onPress: onSell,
        icon: 'BanknotesMini',
      },
    ]
      .map((t) => ({ ...t, isDisabled: loading }))
      .filter((item) => !item.visible || item?.visible?.()) as IButtonItem[];
    const showSize = isVerticalLayout ? 4 : 3;
    return {
      buttons: list.slice(0, showSize),
      options: list.slice(showSize).map((item) => ({
        ...item,
        onPress: () => {
          handlePress(item);
        },
      })),
    };
  }, [
    loading,
    handlePress,
    isVerticalLayout,
    onBuy,
    onSell,
    onSwap,
    onReceive,
    onSend,
  ]);

  return (
    <Box>
      <HStack justifyContent="space-between">
        {!isVerticalLayout && (
          <Token
            flex="1"
            showInfo
            size={8}
            token={{
              name: symbol,
              logoURI,
            }}
          />
        )}
        <HStack
          justifyContent="space-between"
          w={isVerticalLayout ? '100%' : undefined}
        >
          {buttons.map((item) => (
            <ButtonItem
              key={item.id}
              onPress={() => {
                handlePress(item);
              }}
              icon={item.icon}
              text={intl.formatMessage({
                id: item.id,
              })}
              isDisabled={loading}
            />
          ))}
          <BaseMenu ml="26px" options={options}>
            <Pressable>
              <ButtonItem
                icon="EllipsisVerticalOutline"
                text={intl.formatMessage({
                  id: 'action__more',
                })}
                isDisabled={loading}
              />
            </Pressable>
          </BaseMenu>
        </HStack>
      </HStack>
      {ethereumNativeToken && !isAllNetworks(networkId) && (
        <Box>
          <EthTopAprShowControl token={ethereumNativeToken} />
          <ETHRelatedPoolShowControl token={ethereumNativeToken} />
        </Box>
      )}
    </Box>
  );
};
