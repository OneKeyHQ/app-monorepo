import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISignatureItemQueryParams } from '@onekeyhq/shared/types/signatureRecord';

import { SignatureContext } from './Context';

export const groupBy = <T extends { createdAt: number }>(items: T[]) => {
  const resp = items.reduce(
    (acc, item) => {
      const title = formatDate(new Date(item.createdAt), {
        hideTimeForever: true,
      });
      if (!acc[title]) {
        acc[title] = [];
      }
      acc[title].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
  return Object.entries(resp).map(([title, data]) => ({
    title,
    data,
  })) as { title: string; data: T[] }[];
};

export const useGetSignatureSections = <T extends { createdAt: number }>(
  method: (params: ISignatureItemQueryParams) => Promise<T[]>,
) => {
  const ref = useRef<T[]>([]);
  const methodRef = useRef(method);
  const hasLoadedFirstPageRef = useRef(false);
  const resetGenRef = useRef(0);
  const [query, setQuery] = useState<{ offset: number; limit: number }>({
    offset: 0,
    limit: 10,
  });
  const { networkId, searchContent: address } = useContext(SignatureContext);

  // Reset accumulated data and pagination when filters change
  useEffect(() => {
    ref.current = [];
    hasLoadedFirstPageRef.current = false;
    resetGenRef.current += 1;
    setQuery({ offset: 0, limit: 10 });
  }, [networkId, address]);

  const {
    result: { sections, ending },
  } = usePromiseResult(
    async () => {
      const gen = resetGenRef.current;
      const resp = await methodRef.current({
        networkId,
        address,
        offset: query.offset,
        limit: query.limit,
      });
      // Skip stale results from before a filter reset
      if (resetGenRef.current !== gen) {
        return { sections: [], ending: false };
      }
      const isSearch = !networkUtils.isAllNetwork({ networkId }) || address;
      if (!isSearch) {
        if (query.offset === 0) {
          ref.current = [...resp];
        } else {
          ref.current.splice(query.offset, query.limit, ...resp);
        }
      }
      hasLoadedFirstPageRef.current = true;
      return {
        sections: groupBy(isSearch ? resp : ref.current),
        ending: resp.length < query.limit,
      };
    },
    [networkId, query.limit, query.offset, address],
    { initResult: { sections: [], ending: false } },
  );

  const onEndReached = useCallback(() => {
    if (ending || !hasLoadedFirstPageRef.current) {
      return;
    }
    setQuery((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
  }, [ending]);

  return useMemo(() => ({ sections, onEndReached }), [sections, onEndReached]);
};
