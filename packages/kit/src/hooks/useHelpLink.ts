import { useMemo } from 'react';

import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';

export function useHelpLink({ path = '' }: { path: string }) {
  return useMemo(() => {
    return `${HELP_CENTER_URL}/${path.replace(/^\/+/, '')}`;
  }, [path]);
}

export function useTermsAndPrivacyLinks() {
  const termsUrl = useHelpLink({ path: 'articles/11461297' });
  const privacyUrl = useHelpLink({ path: 'articles/11461298' });
  return { termsUrl, privacyUrl };
}
