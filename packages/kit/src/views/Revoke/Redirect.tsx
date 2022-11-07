import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const RedirectOldPathToRevokePage = () => {
  useEffect(() => {
    if (platformEnv.isWeb) {
      window.location.href = '/revoke';
    }
  }, []);

  return null;
};

export default RedirectOldPathToRevokePage;
