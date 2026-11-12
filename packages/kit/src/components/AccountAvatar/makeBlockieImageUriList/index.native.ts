import { useMemo } from 'react';

import type { IUseBlockieImageUri } from './type';

export const useBlockieImageUri: IUseBlockieImageUri = (id?: string) => {
  const uri = useMemo(() => {
    const normalized = id?.replaceAll(':', '').trim().toLowerCase();
    if (!normalized) return '';
    return `onekey-avatar://blockie/v1/${encodeURIComponent(normalized)}`;
  }, [id]);

  return uri;
};
