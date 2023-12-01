import { Suspense } from 'react';

import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import BiologyAuthSwitchContainer from './BiologyAuthSwitchContainer';
import WebAuthSwitchContainer from './WebAuthSwitchContainer';

const UniversalContainer = () => {
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  if (biologyAuthIsSupport) {
    return <BiologyAuthSwitchContainer />;
  }
  if (webAuthIsSupport) {
    return <WebAuthSwitchContainer />;
  }
  return null;
};

export const UniversalContainerWithSuspense = () => (
  <Suspense fallback={null}>
    <UniversalContainer />
  </Suspense>
);
