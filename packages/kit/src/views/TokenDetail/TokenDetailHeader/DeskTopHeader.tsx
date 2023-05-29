import { useMemo } from 'react';
import type { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  IconButton,
  ToastManager,
  Token,
  Typography,
} from '@onekeyhq/components';
import type { ButtonSize, ButtonType } from '@onekeyhq/components/src/Button';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import { TokenVerifiedIcon } from '@onekeyhq/components/src/Token';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/types';
import {
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import { useTokenSupportStakedAssets } from '../../../hooks/useTokens';
import { useMarketTokenItem } from '../../Market/hooks/useMarketToken';
import { EthStakingSource, StakingRoutes } from '../../Staking/typing';

import MoreMenuButton from './MoreMenuButton';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;

export type Props = {
  accountId: string;
  networkId: string;
  token: TokenDO | null | undefined;
  priceReady?: boolean;
  sendAddress?: string;
};

export const FavoritedButton: FC<{
  coingeckoId?: string;
  size?: ButtonSize;
  type?: ButtonType;
  circle?: boolean;
}> = ({ coingeckoId, size, type, circle }) => {
  const intl = useIntl();

  const marketTokenItem = useMarketTokenItem({
    coingeckoId,
  });
  const isDisabled = typeof marketTokenItem === 'undefined';
  // if (isDisabled && isVerticalLayout) {
  //   return null;
  // }
  let iconColor: ThemeToken = marketTokenItem?.favorited
    ? 'icon-warning'
    : 'icon-default';
  if (isDisabled) {
    iconColor = 'icon-disabled';
  }
  return (
    <IconButton
      isDisabled={isDisabled}
      name={marketTokenItem?.favorited ? 'StarSolid' : 'StarOutline'}
      circle={circle}
      iconColor={iconColor}
      onPress={() => {
        if (marketTokenItem) {
          if (marketTokenItem.favorited) {
            backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
              marketTokenItem.coingeckoId,
            );
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__removed' }),
            });
          } else {
            backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
              {
                coingeckoId: marketTokenItem.coingeckoId,
                symbol: marketTokenItem.symbol,
              },
            ]);
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__added_to_favorites' }),
            });
          }
        }
      }}
      size={size}
      type={type}
    />
  );
};

const DeskTopHeader: FC<Props> = ({
  token,
  sendAddress,
  accountId,
  networkId,
}) => {
  const { wallet, network } = useActiveSideAccount({ networkId, accountId });
  const navigation = useNavigation<NavigationProps['navigation']>();
  const stakedSupport = useTokenSupportStakedAssets(
    token?.networkId,
    token?.tokenIdOnNetwork,
  );

  const renderAccountAmountInfo = useMemo(
    () => (
      <HStack space="8px" alignItems="center">
        <Token
          size={8}
          showTokenVerifiedIcon
          token={{ ...token, logoURI: token?.logoURI || network?.logoURI }}
        />
        <Typography.Heading>
          {token?.tokenIdOnNetwork ? token?.symbol : network?.symbol}
        </Typography.Heading>
        <TokenVerifiedIcon size={24} token={token || {}} />
      </HStack>
    ),
    [token, network?.logoURI, network?.symbol],
  );

  const accountOption = useMemo(
    () => (
      <HStack space="16px">
        <IconButton
          circle
          name="PaperAirplaneOutline"
          isDisabled={wallet?.type === 'watching'}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendModalRoutes.PreSendAddress,
                params: {
                  accountId,
                  networkId,
                  from: '',
                  to: '',
                  amount: '',
                  token: token?.tokenIdOnNetwork ?? '',
                  sendAddress,
                },
              },
            });
          }}
        />
        <IconButton
          circle
          name="QrCodeOutline"
          isDisabled={wallet?.type === 'watching'}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Receive,
              params: {
                screen: ReceiveTokenModalRoutes.ReceiveToken,
                params: {},
              },
            });
          }}
        />

        {stakedSupport ? (
          <IconButton
            circle
            size="base"
            name="ArchiveBoxArrowDownOutline"
            isDisabled={wallet?.type === 'watching'}
            onPress={() => {
              if (token && stakedSupport) {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Staking,
                  params: {
                    screen: StakingRoutes.ETHStake,
                    params: {
                      source: EthStakingSource.Lido,
                    },
                  },
                });
              }
            }}
          />
        ) : null}

        <FavoritedButton coingeckoId={token?.coingeckoId} circle />
        <MoreMenuButton
          token={token}
          sendAddress={sendAddress}
          accountId={accountId}
          networkId={networkId}
        />
      </HStack>
    ),
    [
      wallet?.type,
      stakedSupport,
      token,
      navigation,
      accountId,
      networkId,
      sendAddress,
    ],
  );

  return useMemo(
    () => (
      <Box
        w="100%"
        mt="26px"
        mb="32px"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        {renderAccountAmountInfo}
        {accountOption}
      </Box>
    ),
    [renderAccountAmountInfo, accountOption],
  );
};

export default DeskTopHeader;
