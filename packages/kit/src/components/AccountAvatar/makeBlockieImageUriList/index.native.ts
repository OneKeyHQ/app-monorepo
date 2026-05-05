import { useMemo } from 'react';

import makeBlockie from 'ethereum-blockies-base64';

import type { IUseBlockieImageUri } from './type';

const caches: Record<string, string> = {};

export const useBlockieImageUri: IUseBlockieImageUri = (id?: string) => {
  const uri = useMemo(() => {
    if (!id) return '';
    if (caches[id]) return caches[id];
    const dataUri = makeBlockie(id);
    caches[id] = dataUri;
    return dataUri;
  }, [id]);

  return uri;
};
