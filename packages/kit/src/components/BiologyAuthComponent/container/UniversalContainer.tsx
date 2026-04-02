import { Suspense } from 'react';

import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import BiologyAuthSwitchContainer from './BiologyAuthSwitchContainer';
import WebAuthSwitchContainer from './WebAuthSwitchContainer';

interface IUniversalContainerProps {
  skipAuth?: boolean;
}

const UniversalContainer = ({ skipAuth }: IUniversalContainerProps) => {
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  if (biologyAuthIsSupport) {
    return <BiologyAuthSwitchContainer skipAuth={skipAuth} />;
  }
  if (webAuthIsSupport) {
    return <WebAuthSwitchContainer skipRegistration={skipAuth} />;
  }
  return null;
};

interface IUniversalContainerWithSuspenseProps {
  skipAuth?: boolean;
}

export const UniversalContainerWithSuspense = ({
  skipAuth,
}: IUniversalContainerWithSuspenseProps) => (
  <Suspense fallback={null}>
    <UniversalContainer skipAuth={skipAuth} />
  </Suspense>
);
