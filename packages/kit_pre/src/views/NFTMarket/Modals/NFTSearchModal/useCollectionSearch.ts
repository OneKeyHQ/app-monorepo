import { useEffect, useState } from 'react';

import type { Collection } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

export const useCollectionSearch = (keyword: string, networkId: string) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Collection[]>([]);
  const { serviceNFT } = backgroundApiProxy;

  useEffect(() => {
    async function main() {
      if (keyword.length === 0) {
        setResult([]);
        return;
      }
      setLoading(true);
      setResult([]);
      try {
        const data = await serviceNFT.searchCollections({
          chain: networkId,
          name: keyword,
        });

        if (data) {
          setResult(data);
        } else {
          setResult([]);
        }
      } finally {
        setLoading(false);
      }
    }
    main();
  }, [keyword, networkId, serviceNFT]);
  return {
    loading,
    result,
  };
};
