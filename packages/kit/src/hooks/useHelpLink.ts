import { useMemo } from 'react';

import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';

export function useHelpLink({ path = '' }: { path: string }) {
  return useMemo(() => {
    return `${HELP_CENTER_URL}/${path.replace(/^\/+/, '')}`;
  }, [path]);
}
