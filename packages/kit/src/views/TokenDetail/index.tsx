import type { FC } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Icon, Select, useIsVerticalLayout } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import { useActiveWalletAccount } from '../../hooks';
import { useSimpleTokenPriceValue } from '../../hooks/useManegeTokenPrice';
import { useTokenInfo } from '../../hooks/useTokenInfo';
import { ModalRoutes, RootRoutes } from '../../routes/types';
import { ManageTokenRoutes } from '../ManageTokens/types';
import PriceChart from '../PriceChart/PriceChart';
import StakedAssets from '../Staking/components/StakedAssets';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import TokenInfo from './TokenInfo';

import type { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import type { TokenDetailRoutesParams } from './routes';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TokenDetailViewProps = NativeStackScreenProps<
  TokenDetailRoutesParams,
  HomeRoutes.ScreenTokenDetail
>;

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const TokenDetail: FC<TokenDetailViewProps> = () => {
  const intl = useIntl();
  const firstUpdate = useRef(true);
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const isVertical = useIsVerticalLayout();
  // const { charts } = useManageTokens();
  const { accountId, networkId, tokenId } = route.params;
  const price = useSimpleTokenPriceValue({
    networkId,
    contractAdress: tokenId,
  });
  const token = useTokenInfo({ networkId, tokenIdOnNetwork: tokenId });
  const { account: activeAccount, network: activeNetwork } =
    useActiveWalletAccount();

  const priceReady = useMemo(() => {
    if (!token) {
      return false;
    }
    return !!price;
  }, [price, token]);

  useLayoutEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }
    // Go back to Home if account or network changed.
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [activeAccount?.id, activeNetwork?.id, navigation]);

  useEffect(() => {
    navigation.setOptions({ title: token?.name || activeAccount?.name || '' });
  }, [navigation, token, accountId, networkId, activeAccount?.name]);

  const onHeaderRightPress = useCallback(
    (v) => {
      if (v === 'priceAlert') {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.ManageToken,
          params: {
            screen: ManageTokenRoutes.PriceAlertList,
            params: {
              token: token as Token,
            },
          },
        });
      }
    },
    [token, navigation],
  );

  useLayoutEffect(() => {
    if (!priceReady) {
      return;
    }
    if (!isVertical) {
      return;
    }
    navigation.setOptions({
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <Select
          dropdownPosition="right"
          title={intl.formatMessage({ id: 'action__more' })}
          onChange={onHeaderRightPress}
          footer={null}
          activatable={false}
          triggerProps={{
            width: '40px',
          }}
          dropdownProps={{
            width: 248,
          }}
          options={[
            {
              label: intl.formatMessage({
                id: 'form__price_alert',
              }),
              value: 'priceAlert',
              iconProps: { name: 'BellOutline' },
            },
          ]}
          renderTrigger={() => <Icon name="DotsHorizontalOutline" />}
        />
      ),
    });
  }, [navigation, intl, onHeaderRightPress, priceReady, token, isVertical]);

  const headerView = (
    <>
      <TokenInfo token={token} priceReady={priceReady} />
      <StakedAssets
        networkId={token?.networkId}
        tokenIdOnNetwork={token?.tokenIdOnNetwork}
      />
      <PriceChart
        style={{
          marginBottom: 20,
        }}
        networkId={networkId}
        contract={tokenId}
      />
    </>
  );

  return (
    <Box
      bg="background-default"
      flex={1}
      marginX="auto"
      w="100%"
      maxW={MAX_PAGE_CONTAINER_WIDTH}
    >
      <TxHistoryListView
        accountId={accountId}
        networkId={networkId}
        tokenId={tokenId}
        headerView={headerView}
      />
    </Box>
  );
};
export default TokenDetail;
