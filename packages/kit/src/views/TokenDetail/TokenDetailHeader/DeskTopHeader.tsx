import { useContext, useMemo } from 'react';
import type { FC } from 'react';

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
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/types';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { useActiveSideAccount } from '../../../hooks/useActiveSideAccount';
import { useTokenSupportStakedAssets } from '../../../hooks/useTokens';
import {
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { useMarketTokenItem } from '../../Market/hooks/useMarketToken';
import { EthStakingSource, StakingRoutes } from '../../Staking/typing';
import { TokenDetailContext } from '../context';

import MoreMenuButton from './MoreMenuButton';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;

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

const DeskTopHeader: FC = () => {
  const context = useContext(TokenDetailContext);
  const { networkId, accountId, sendAddress, coingeckoId } =
    context?.routeParams ?? {};
  const { name, symbol, logoURI, defaultToken } = context?.detailInfo ?? {};
  const { wallet } = useActiveSideAccount({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const navigation = useNavigation<NavigationProps['navigation']>();
  const stakedSupport = useTokenSupportStakedAssets(
    defaultToken?.networkId,
    defaultToken?.tokenIdOnNetwork,
  );

  const renderAccountAmountInfo = useMemo(
    () => (
      <HStack space="8px" alignItems="center">
        <Token
          size={8}
          showTokenVerifiedIcon
          token={{ name, symbol, logoURI }}
        />
        <Typography.Heading>{symbol}</Typography.Heading>
        {/* <TokenVerifiedIcon size={24} token={token || {}} /> */}
      </HStack>
    ),
    [name, symbol, logoURI],
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
                  accountId: accountId ?? '',
                  networkId: accountId ?? '',
                  from: '',
                  to: '',
                  amount: '',
                  token: defaultToken?.address ?? '',
                  tokenSendAddress: sendAddress,
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
              if (defaultToken && stakedSupport) {
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

        <FavoritedButton coingeckoId={coingeckoId} circle />
        <MoreMenuButton
          token={defaultToken}
          sendAddress={sendAddress}
          accountId={accountId ?? ''}
          networkId={networkId ?? ''}
        />
      </HStack>
    ),
    [
      wallet?.type,
      stakedSupport,
      defaultToken,
      navigation,
      accountId,
      networkId,
      sendAddress,
      coingeckoId,
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
