import { useContext, useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

import { OutputCrosschainTokenSelectorContext } from './context';
import { useContextAccountTokens } from './hooks';

export const Observer = () => {
  const { networkId, accountId } = useContext(
    OutputCrosschainTokenSelectorContext,
  );
  const tokens = useContextAccountTokens(networkId, accountId);
  useEffect(() => {
    if (networkId && accountId) {
      backgroundApiProxy.servicePrice.fetchSimpleTokenPrice({
        accountId,
        networkId,
        tokenIds: tokens.map((item) => item.tokenIdOnNetwork),
      });
    }
  }, [tokens, networkId, accountId]);

  return null;
};
