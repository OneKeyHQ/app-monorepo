import { useEffect, useState } from 'react';

import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

function useTokenInfo({
  networkId,
  tokenIdOnNetwork,
}: {
  networkId: string;
  tokenIdOnNetwork?: string;
}) {
  const [tokenInfo, setTokenInfo] = useState<Token>();
  useEffect(() => {
    (async () => {
      const token = await backgroundApiProxy.engine.getOrAddToken(
        networkId,
        tokenIdOnNetwork ?? '',
      );
      setTokenInfo(token);
    })();
  }, [networkId, tokenIdOnNetwork]);
  return tokenInfo;
}

export { useTokenInfo };
