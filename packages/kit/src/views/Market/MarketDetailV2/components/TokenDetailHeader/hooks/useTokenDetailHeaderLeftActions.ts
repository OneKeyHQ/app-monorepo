import { useCallback } from 'react';

import { useClipboard } from '@onekeyhq/components';
import { openTokenDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

interface IUseTokenDetailHeaderLeftActionsParams {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
}

export function useTokenDetailHeaderLeftActions({
  tokenDetail,
  networkId,
}: IUseTokenDetailHeaderLeftActionsParams) {
  const { copyText } = useClipboard();

  const { symbol = '', address = '', extraData } = tokenDetail || {};

  const { website, twitter } = extraData || {};

  const handleCopyAddress = useCallback(() => {
    if (address) {
      copyText(address);
    }
  }, [address, copyText]);

  const handleOpenContractAddress = useCallback(() => {
    if (address && networkId) {
      void openTokenDetailsUrl({
        networkId,
        tokenAddress: address,
        openInExternal: true,
      });
    }
  }, [address, networkId]);

  const handleOpenWebsite = useCallback(() => {
    if (website) {
      openUrlExternal(website);
    }
  }, [website]);

  const handleOpenTwitter = useCallback(() => {
    if (twitter) {
      openUrlExternal(twitter);
    }
  }, [twitter]);

  const handleOpenXSearch = useCallback(() => {
    if (address) {
      const searchTerms = [];
      if (symbol) searchTerms.push(`$${symbol}`);
      searchTerms.push(address);
      const q = encodeURIComponent(
        searchTerms.length > 1
          ? `(${searchTerms.join(' OR ')})`
          : searchTerms[0],
      );
      const searchUrl = `https://x.com/search?q=${q}&src=typed_query&f=live`;
      openUrlExternal(searchUrl);
    }
  }, [symbol, address]);

  return {
    handleCopyAddress,
    handleOpenContractAddress,
    handleOpenWebsite,
    handleOpenTwitter,
    handleOpenXSearch,
  };
}
