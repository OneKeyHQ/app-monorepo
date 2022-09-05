import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Icon, Select } from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks';
import { useTokenInfo } from '../../hooks/useTokenInfo';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  RootRoutes,
} from '../../routes/types';
import { ManageTokenRoutes } from '../ManageTokens/types';
import PriceChart from '../PriceChart/PriceChart';
import StakedAssets from '../Staking/components/StakedAssets';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import { TokenDetailRoutesParams } from './routes';
import TokenInfo from './TokenInfo';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TokenDetailViewProps = NativeStackScreenProps<
  TokenDetailRoutesParams,
  HomeRoutes.ScreenTokenDetail
>;

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const TokenDetail: React.FC<TokenDetailViewProps> = () => {
  const intl = useIntl();
  const firstUpdate = useRef(true);
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { accountId, networkId, tokenId } = route.params;
  const token = useTokenInfo({ networkId, tokenIdOnNetwork: tokenId });
  const { account: activeAccount, network: activeNetwork } =
    useActiveWalletAccount();

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
    const title = token?.name || '';
    if (title) {
      navigation.setOptions({ title });
    } else {
      backgroundApiProxy.engine
        .getAccount(accountId, networkId)
        .then((account) => {
          navigation.setOptions({ title: account.name });
        })
        .catch(() => {
          console.error('find account error');
        });
    }
  }, [navigation, token, accountId, networkId]);

  const setHeaders = useCallback(() => {
    if (!platformEnv.isNative) {
      return;
    }
    const currentToken = token;
    navigation.setOptions({
      headerRight: () => (
        <Select
          dropdownPosition="right"
          title={intl.formatMessage({ id: 'action__more' })}
          onChange={(v) => {
            if (v === 'priceAlert') {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ManageToken,
                params: {
                  screen: ManageTokenRoutes.PriceAlertList,
                  params: {
                    token: currentToken as Token,
                  },
                },
              });
            }
          }}
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
  }, [navigation, intl, token]);

  const headerView = (
    <>
      <TokenInfo token={token} />
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
        onChartDataLoaded={setHeaders}
      />
    </>
  );

  return (
    <Box bg="background-default" flex={1}>
      <Box flex={1} marginX="auto" w="100%" maxW={MAX_PAGE_CONTAINER_WIDTH}>
        <TxHistoryListView
          accountId={accountId}
          networkId={networkId}
          tokenId={tokenId}
          headerView={headerView}
        />
      </Box>
    </Box>
  );
};
export default TokenDetail;
