import type { FC } from 'react';
import { useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Pressable,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isValidCoingeckoId } from '@onekeyhq/engine/src/managers/token';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { freezedEmptyObject } from '@onekeyhq/shared/src/consts/sharedConsts';
import {
  isLightningNetworkByImpl,
  isLightningNetworkByNetworkId,
} from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation, useNetwork, useWallet } from '../../../hooks';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import {
  MainRoutes,
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  TabRoutes,
} from '../../../routes/routesEnum';
import { openUrlExternal } from '../../../utils/openUrl';
import BaseMenu from '../../Overlay/BaseMenu';
import { SendModalRoutes } from '../../Send/enums';
import { TokenDetailContext } from '../context';

import { ButtonItem } from './ButtonItem';
import { FavoritedButton } from './Header';

import type { ITokenDetailContext } from '../context';
import type { IButtonItem } from './ButtonItem';

type ISingleChainInfo = {
  network: Network;
  account: Account;
  token: TokenType;
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
    coingeckoId,
  } = context?.routeParams ?? {};

  const { symbol, logoURI, fiatUrls } = context?.detailInfo ?? {};

  const { isLoading: detailLoading, detailInfo } =
    context ?? (freezedEmptyObject as ITokenDetailContext);

  const { wallet } = useWallet({
    walletId,
  });

  const loading = useMemo(
    () => isAllNetworks(networkId) && detailLoading,
    [detailLoading, networkId],
  );

  const { network: currentNetwork } = useNetwork({ networkId });

  const filter = useCallback(
    ({ network }: { network?: Network | null }) =>
      !!network?.id &&
      !!detailInfo?.tokens?.some((t) => t.networkId === network?.id),
    [detailInfo?.tokens],
  );

  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    networkId,
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
      if (isLightningNetworkByImpl(network.impl)) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenModalRoutes.CreateInvoice,
            params: {
              networkId: network.id,
              accountId: account.id,
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
    async ({ token, account: a, network: n }: ISingleChainInfo) => {
      if (!token) {
        return;
      }
      const isLightningNetwork = isLightningNetworkByNetworkId(n.id);
      if (isLightningNetwork) {
        backgroundApiProxy.serviceSwap
          .sellToken(token, !isLightningNetwork)
          .then(() => {
            // Switch to LN to BTC swap if is lightning network
            if (isLightningNetwork) {
              setTimeout(() => {
                backgroundApiProxy.serviceSwap.switchToNativeOutputToken(
                  n.id === OnekeyNetwork.lightning
                    ? OnekeyNetwork.btc
                    : OnekeyNetwork.tbtc,
                );
              }, 50);
            }
          });
      } else {
        await backgroundApiProxy.serviceSwap.buyToken(token);
      }
      if (a && n) {
        backgroundApiProxy.serviceSwap.setRecipientToAccount(a, n);
      }
      navigation.navigate(RootRoutes.Main, {
        screen: MainRoutes.Tab,
        params: {
          screen: TabRoutes.Swap,
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
      openUrlExternal(signedUrl);
    },
    [],
  );

  const onSell = useCallback(
    async ({ account, network, token }: ISingleChainInfo) => {
      const signedUrl = await backgroundApiProxy.serviceFiatPay.getFiatPayUrl({
        type: 'sell',
        address: account?.address,
        tokenAddress: token?.address,
        networkId: network?.id,
      });
      openUrlExternal(signedUrl);
    },
    [],
  );

  const handlePress = useCallback(
    (item: IButtonItem) => {
      selectNetworkAccount().then(({ network, account }) => {
        const token = detailInfo?.tokens?.find(
          (t) =>
            network?.id ===
            (t.networkId ?? `${t.impl ?? ''}--${t.chainId ?? ''}`),
        );
        if (token) {
          item.onPress?.({
            network,
            account,
            token: {
              ...token,
              sendAddress,
            },
          });
        }
      });
    },
    [selectNetworkAccount, detailInfo?.tokens, sendAddress],
  );

  const showMoreOption = useMemo(
    () => !currentNetwork?.settings.hiddenAccountInfoMoreOption,
    [currentNetwork],
  );

  const isWatchOnly = useMemo(() => wallet?.type === 'watching', [wallet]);

  const { buttons, options } = useMemo(() => {
    const list: IButtonItem[] = [
      {
        id: 'action__send',
        onPress: onSend,
        icon: 'PaperAirplaneOutline',
        isDisabled: isWatchOnly,
      },
      {
        id: 'action__receive',
        onPress: onReceive,
        icon: 'QrCodeMini',
        isDisabled: isWatchOnly,
      },
      {
        id: 'title__swap',
        onPress: onSwap,
        icon: 'ArrowsRightLeftSolid',
        isDisabled: isWatchOnly,
      },
      {
        id: 'action__buy',
        onPress: onBuy,
        icon: 'PlusMini',
        visible: () =>
          !platformEnv.isAppleStoreEnv &&
          showMoreOption &&
          !!fiatUrls?.[networkId]?.buy,
        isDisabled: isWatchOnly,
      },
      {
        id: 'action__sell',
        onPress: onSell,
        icon: 'BanknotesMini',
        visible: () =>
          !platformEnv.isAppleStoreEnv &&
          showMoreOption &&
          !!fiatUrls?.[networkId]?.sell,
        isDisabled: isWatchOnly,
      },
    ].filter((item) => !item.visible || item?.visible?.()) as IButtonItem[];
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
    networkId,
    fiatUrls,
    handlePress,
    isVerticalLayout,
    onBuy,
    onSell,
    onSwap,
    onReceive,
    onSend,
    showMoreOption,
    isWatchOnly,
  ]);

  return (
    <Box>
      <HStack justifyContent="space-between">
        {!isVerticalLayout && (
          <HStack flex="1" alignItems="center">
            <Token
              showInfo={false}
              size={8}
              token={{
                logoURI,
              }}
            />
            <Typography.Heading ml="2">{symbol}</Typography.Heading>
          </HStack>
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
              isDisabled={item.isDisabled}
            />
          ))}
          {isValidCoingeckoId(coingeckoId) && !isVerticalLayout ? (
            <FavoritedButton coingeckoId={coingeckoId} />
          ) : null}
          {showMoreOption && options?.length ? (
            <BaseMenu ml="26px" options={options}>
              <Pressable flex={isVerticalLayout ? 1 : undefined}>
                <ButtonItem
                  icon="EllipsisVerticalOutline"
                  text={intl.formatMessage({
                    id: 'action__more',
                  })}
                  isDisabled={loading}
                />
              </Pressable>
            </BaseMenu>
          ) : null}
        </HStack>
      </HStack>
    </Box>
  );
};
