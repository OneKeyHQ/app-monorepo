import React, { useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import { Box } from '@onekeyhq/components';

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

  return (
    <Box bg="background-default" flex={1}>
      <HistoricalRecords
        accountId={accountId}
        networkId={networkId}
        tokenId={tokenId}
        headerView={<TokenInfo token={token} network={undefined} />}
      />
    </Box>
  );
};
export default TokenDetail;
