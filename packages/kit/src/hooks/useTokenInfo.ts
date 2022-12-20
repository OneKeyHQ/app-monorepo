import { useEffect, useState } from 'react';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useNetworkTokens } from './useTokens';

function useTokenInfo({
  networkId,
  tokenIdOnNetwork,
}: {
  networkId: string;
  tokenIdOnNetwork?: string;
}) {
  const networkTokens = useNetworkTokens(networkId);
  const tokenInfoInRedux = tokenIdOnNetwork
    ? networkTokens.find((item) => item.tokenIdOnNetwork === tokenIdOnNetwork)
    : undefined;

  const [tokenInfo, setTokenInfo] = useState<Token | undefined>(
    tokenInfoInRedux,
  );
  useEffect(() => {
    (async () => {
      if (tokenInfoInRedux) {
        return;
      }
      const token = tokenIdOnNetwork
        ? await backgroundApiProxy.engine.ensureTokenInDB(
            networkId,
            tokenIdOnNetwork,
          )
        : await backgroundApiProxy.engine.getNativeTokenInfo(networkId);

      setTokenInfo(token);
    })();
  }, [networkId, tokenIdOnNetwork, tokenInfoInRedux]);
  return tokenInfo;
}

export { useTokenInfo };
