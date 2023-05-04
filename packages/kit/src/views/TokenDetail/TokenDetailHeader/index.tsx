import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, HStack, useIsVerticalLayout } from '@onekeyhq/components';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/types';
import { TabRoutes } from '@onekeyhq/kit/src/routes/types';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import PriceChart from '../../PriceChart/PriceChart';
import { KeleETHUnstakeBulletin } from '../../Staking/components/KeleETHUnstakeBulletin';
import StakedAssets from '../../Staking/components/StakedAssets';

import DeskTopHeader from './DeskTopHeader';
import MoreMenuButton from './MoreMenuButton';

import type { HomeRoutes } from '../../../routes/types';
import type { TokenDetailRoutesParams } from '../routes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TokenDetailViewProps = NativeStackScreenProps<
  TokenDetailRoutesParams,
  HomeRoutes.ScreenTokenDetail
>;

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;

export enum TabEnum {
  Assets = 'Assets',
  History = 'History',
  Info = 'Info',
}
export type HeaderProps = {
  accountId: string;
  networkId: string;
  token: TokenDO | undefined;
  priceReady?: boolean;
  sendAddress?: string;
} & ComponentProps<typeof Box>;

const TokenDetailHeader: FC<HeaderProps> = ({
  accountId,
  networkId,
  token,
  sendAddress,
  priceReady,
  ...props
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { network, account } = useActiveSideAccount({
    accountId,
    networkId,
  });
  const onSwap = useCallback(
    async (type: 'buy' | 'sell') => {
      if (token) {
        if (type === 'buy') {
          backgroundApiProxy.serviceSwap.buyToken(token);
        } else {
          backgroundApiProxy.serviceSwap.sellToken(token);
        }

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
    },
    [network, account, navigation, token],
  );

  return (
    <Box {...props}>
      <KeleETHUnstakeBulletin token={token} />

      {!isVerticalLayout && (
        <DeskTopHeader
          token={token}
          sendAddress={sendAddress}
          priceReady={priceReady}
          networkId={networkId}
          accountId={accountId}
        />
      )}
      {token && (
        <Box mt={{ base: '16px', md: 0 }}>
          <PriceChart
            networkId={networkId}
            contract={token.tokenIdOnNetwork}
            coingeckoId={token?.coingeckoId}
          />
        </Box>
      )}
      {isVerticalLayout && (
        <HStack space="8px" mt="24px">
          <Button
            size="lg"
            onPress={() => {
              onSwap('buy');
            }}
            flex={1}
          >
            {intl.formatMessage({ id: 'action__buy' })}
          </Button>
          <Button
            size="lg"
            onPress={() => {
              onSwap('sell');
            }}
            flex={1}
          >
            {intl.formatMessage({ id: 'action__sell' })}
          </Button>
          <MoreMenuButton
            token={token}
            sendAddress={sendAddress}
            accountId={accountId}
            networkId={networkId}
          />
        </HStack>
      )}
      {isVerticalLayout && (
        <StakedAssets
          networkId={token?.networkId}
          tokenIdOnNetwork={token?.tokenIdOnNetwork}
        />
      )}
    </Box>
  );
};
export default TokenDetailHeader;
