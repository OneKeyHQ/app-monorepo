import type { FC } from 'react';
import { useEffect } from 'react';

import { useRouter } from 'expo-router';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const RedirectProvider: FC = ({ children }) => {
  const router = useRouter();

  useEffect(() => {
    if (platformEnv.isNative) return;
    const hash = window?.location?.hash ?? '';
    const hashPath = hash.replace(/^#/, '');

    if (!hashPath || hashPath === '/') return;

    router.push(hashPath);
    if (window?.location?.hash) window.location.hash = '';

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
};

export default RedirectProvider;
