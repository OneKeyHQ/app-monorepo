import { useCallback, useContext, useMemo, useRef, useState } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { ISignatureItemQueryParams } from '@onekeyhq/shared/types/signatureRecord';

import { SignatureContext } from './Context';

export const groupBy = <T extends { createdAt: number }>(items: T[]) => {
  const resp = items.reduce((acc, item) => {
    const title = formatDate(new Date(item.createdAt), {
      hideTimeForever: true,
    });
    if (!acc[title]) {
      acc[title] = [];
    }
    acc[title].push(item);
    return acc;
  }, {} as Record<string, T[]>);
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
  const [query, setQuery] = useState<{ offset: number; limit: number }>({
    offset: 0,
    limit: 10,
  });
  const { networkId } = useContext(SignatureContext);
  const {
    result: { sections, ending },
  } = usePromiseResult(
    async () => {
      const resp = await methodRef.current({
        networkId,
        offset: query.offset,
        limit: query.limit,
      });
      ref.current.splice(query.offset, query.limit, ...resp);
      return {
        sections: groupBy(ref.current),
        ending: resp.length < query.limit,
      };
    },
    [networkId, query.limit, query.offset],
    { initResult: { sections: [], ending: false } },
  );

  const onEndReached = useCallback(() => {
    if (ending) {
      return;
    }
    setQuery((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
  }, [ending]);

  return useMemo(() => ({ sections, onEndReached }), [sections, onEndReached]);
};
