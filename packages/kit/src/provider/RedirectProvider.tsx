import type { FC } from 'react';
import { useEffect } from 'react';

import { useLinkTo } from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const RedirectProvider: FC = ({ children }) => {
  const linkTo = useLinkTo();
  useEffect(() => {
    if (platformEnv.isNative) return;
    const hash = window?.location?.hash ?? '';
    const hashPath = hash.replace(/^#/, '');

    if (!hashPath || hashPath === '/') return;

    linkTo(hashPath);
    if (window?.location?.hash) window.location.hash = '';

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
};

export default RedirectProvider;
