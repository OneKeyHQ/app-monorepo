import React, { useEffect, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import { Box } from '@onekeyhq/components';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';

import { useActiveWalletAccount } from '../../hooks/redux';
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
  const { accountId, networkId, tokenId } = route.params;
  const { account } = useActiveWalletAccount();
  const { accountTokensMap, nativeToken } = useManageTokens();
  const token = accountTokensMap.get(tokenId);

  useEffect(() => {
    const title = token?.name || nativeToken?.name || account?.name;
    navigation.setOptions({ title });
  }, [navigation, account, token, nativeToken]);

  const headerView = useMemo(
    () => <TokenInfo token={token} network={undefined} />,
    [token],
  );

  return (
    <Box bg="background-default" flex={1}>
      <Box flex={1} marginX="auto" w="100%" maxW={MAX_PAGE_CONTAINER_WIDTH}>
        <HistoricalRecords
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
