import type { ComponentProps, FC } from 'react';
import { useCallback, useContext } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, HStack, useIsVerticalLayout } from '@onekeyhq/components';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/types';
import type { HomeRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { TabRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import MarketPriceChart from '../../Market/Components/MarketDetail/MarketPriceChart';
import {
  ETHRelatedPoolShowControl,
  EthTopAprShowControl,
} from '../../Staking/components/StakingEthOptions';
import { TokenDetailContext } from '../context';

import DeskTopHeader from './DeskTopHeader';
import MoreMenuButton from './MoreMenuButton';

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
export type HeaderProps = ComponentProps<typeof Box>;

const TokenDetailHeader: FC<HeaderProps> = (props) => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const context = useContext(TokenDetailContext);

  const { networkId, coingeckoId, accountId, sendAddress } =
    context?.routeParams ?? {};

  const { tokens, defaultToken } = context?.detailInfo ?? {};

  const { network, account } = useActiveSideAccount({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
  });
  const onSwap = useCallback(
    async (type: 'buy' | 'sell') => {
      if (tokens?.length) {
        const token = tokens[0];
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
    [network, account, navigation, tokens],
  );

  return (
    <Box {...props}>
      {!isVerticalLayout && <DeskTopHeader />}
      <Box mt={{ base: '16px', md: 0 }}>
        <MarketPriceChart coingeckoId={coingeckoId ?? ''} />
      </Box>
      {isVerticalLayout && (
        <HStack space="8px" mt="24px">
          <Button
            size="lg"
            onPress={() => {
              onSwap('buy');
            }}
            flex={1}
          >
            {intl.formatMessage({ id: 'Market__buy' })}
          </Button>
          <Button
            size="lg"
            onPress={() => {
              onSwap('sell');
            }}
            flex={1}
          >
            {intl.formatMessage({ id: 'Market__sell' })}
          </Button>
          <MoreMenuButton
            token={defaultToken}
            sendAddress={sendAddress}
            accountId={accountId ?? ''}
            networkId={networkId ?? ''}
          />
        </HStack>
      )}
      {isVerticalLayout && (
        <Box>
          <EthTopAprShowControl token={defaultToken} />
          <ETHRelatedPoolShowControl token={defaultToken} />
        </Box>
      )}
    </Box>
  );
};
export default TokenDetailHeader;
