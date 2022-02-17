import React, { useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';

import { Box, ScrollView, VStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/kit/src/config';

import { useNavigation } from '../..';
import engine from '../../engine/EngineProvider';
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
  const [token, setToken] = useState<Token>();

  useEffect(() => {
    async function main() {
      const account = await engine.getAccount(accountId, networkId);
      const filterToken = account.tokens.find((t) => t.id === tokenId);
      setToken(filterToken);

      if (filterToken) {
        navigation.setOptions({
          title: filterToken.name,
        });
      }
    }
    main();
  }, [accountId, navigation, networkId, tokenId]);

  return (
    <ScrollView
      contentContainerStyle={{
        maxWidth: MAX_PAGE_CONTAINER_WIDTH,
        marginHorizontal: 'auto',
      }}
    >
      <VStack>
        <Box>
          <TokenInfo accountId={accountId} token={token} />
          <HistoricalRecords
            accountId={accountId}
            networkId={networkId}
            tokenId={token?.tokenIdOnNetwork}
            // 接口修改为 tokenId 时需要更新
            // tokenId={token?.id}
          />
        </Box>
      </VStack>
    </ScrollView>
  );
};
export default TokenDetail;
