import React, { useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import { Box } from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useTokenInfo } from '../../hooks/useTokenInfo';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
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
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { accountId, networkId, tokenId } = route.params;
  const [network, setNetwork] = useState<Network>();
  const token = useTokenInfo({ networkId, tokenIdOnNetwork: tokenId });

  useEffect(() => {
    backgroundApiProxy.engine.getNetwork(networkId).then(setNetwork);
  }, [networkId]);

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
        platform={network?.shortCode}
        contract={token?.tokenIdOnNetwork}
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
