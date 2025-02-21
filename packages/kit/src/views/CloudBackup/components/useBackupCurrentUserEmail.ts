import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export function useBackupCurrentUserEmail() {
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    void backgroundApiProxy.serviceCloudBackup
      .getCurrentUserEmail()
      .then((email) => {
        setCurrentUserEmail(email ?? '');
      });
  }, []);

  return currentUserEmail;
}
