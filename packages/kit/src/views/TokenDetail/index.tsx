import React, { useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';

import { Box } from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';

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
  const [network, setNetwork] = useState<Network>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function main() {
      setReady(false);
      const [account, resultNetwork] = await Promise.all([
        engine.getAccount(accountId, networkId),
        engine.getNetwork(networkId),
      ]);
      const filterToken = account.tokens.find((t) => t.id === tokenId);
      setToken(filterToken);
      setNetwork(resultNetwork);
      setReady(true);

      let title;
      if (filterToken) {
        title = filterToken.name;
      } else if (resultNetwork) {
        title = resultNetwork.symbol;
      } else {
        title = account.name;
      }
      navigation.setOptions({
        title,
      });
    }
    main();
  }, [accountId, navigation, networkId, tokenId]);

  return (
    <Box bg="background-default" flex={1}>
      <HistoricalRecords
        accountId={ready ? accountId : null}
        networkId={networkId}
        tokenId={token?.tokenIdOnNetwork}
        // 接口修改为 tokenId 时需要更新
        // tokenId={tokenId}
        headerView={
          <TokenInfo
            accountId={ready ? accountId : null}
            token={token}
            network={network}
          />
        }
      />
    </Box>
  );
};
export default TokenDetail;
