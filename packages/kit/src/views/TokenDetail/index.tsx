import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useDeepCompareMemo } from 'use-deep-compare';

import { Box } from '@onekeyhq/components';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useManageTokens } from '../../hooks/useManageTokens';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import HistoricalRecords from '../Wallet/HistoricalRecords';

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
  const { accountId, networkId, tokenId, historyFilter } = route.params;
  const [account, setAccount] = useState<Account>();
  const [network, setNetwork] = useState<Network>();
  const { accountTokensMap, nativeToken } = useManageTokens();

  const token = useDeepCompareMemo(
    () => accountTokensMap.get(tokenId),
    [accountTokensMap],
  );

  useEffect(() => {
    backgroundApiProxy.engine
      .getAccount(accountId, networkId)
      .then((accountById) => {
        setAccount(accountById);
      })
      .catch(() => {
        console.error('find account error');
      });
    backgroundApiProxy.engine.getNetwork(networkId).then((result) => {
      setNetwork(result);
    });
  }, [accountId, networkId]);

  useLayoutEffect(() => {
    const title = token?.name || nativeToken?.name || account?.name;
    navigation.setOptions({ title });
  }, [navigation, account, token, nativeToken]);

  const headerView = useMemo(
    () => <TokenInfo token={token} network={network} />,
    [network, token],
  );

  return (
    <Box bg="background-default" flex={1}>
      <Box flex={1} marginX="auto" w="100%" maxW={MAX_PAGE_CONTAINER_WIDTH}>
        <HistoricalRecords
          accountId={accountId}
          networkId={networkId}
          tokenId={tokenId}
          headerView={headerView}
          historyFilter={historyFilter}
        />
      </Box>
    </Box>
  );
};
export default TokenDetail;
