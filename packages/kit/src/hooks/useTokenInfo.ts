import { useEffect, useState } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useNetwork } from './useNetwork';
import { useNetworkTokens } from './useTokens';

function useTokenInfo({
  networkId,
  tokenIdOnNetwork,
}: {
  networkId: string;
  tokenIdOnNetwork?: string;
}) {
  const { network } = useNetwork({ networkId });
  const nativeTokenInfo = network
    ? {
        id: network.id,
        name: network.name,
        networkId,
        tokenIdOnNetwork: '',
        symbol: network.symbol,
        decimals: network.decimals,
        logoURI: network.logoURI,
      }
    : undefined;
  const networkTokens = useNetworkTokens(networkId);
  const tokenInfoInRedux = tokenIdOnNetwork
    ? networkTokens.find((item) => item.tokenIdOnNetwork === tokenIdOnNetwork)
    : nativeTokenInfo;

  const [tokenInfo, setTokenInfo] = useState<Token | undefined>(
    tokenInfoInRedux,
  );
  useEffect(() => {
    (async () => {
      if (tokenInfoInRedux) {
        return;
      }
      const token = await backgroundApiProxy.engine.ensureTokenInDB(
        networkId,
        tokenIdOnNetwork ?? '',
      );
      setTokenInfo(token);
    })();
  }, [networkId, tokenIdOnNetwork, tokenInfoInRedux]);
  return tokenInfoInRedux ?? tokenInfo;
}

export { useTokenInfo };
