import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import useIsLowPerformanceDevice from '../hooks/useIsLowPerformanceDevice';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';

const Loading = () => (
  <Stack flex={1} alignContent="center" justifyContent="center">
    <Spinner size="large" />
  </Stack>
);

function LoadingScreen({ children }: PropsWithChildren<unknown>) {
  const [isTransitionEnd, setIsTransitionEnd] = useState(false);
  const navigation = useNavigation();
  useEffect(() => {
    // 'onTransitionEnd' event is missing in react navigation types
    const unsubscribe = navigation.addListener('transitionEnd' as any, () => {
      setIsTransitionEnd(true);
    });
    return unsubscribe;
  }, [navigation]);
  return isTransitionEnd ? children : <Loading />;
}

export function Screen({ children }: PropsWithChildren<unknown>) {
  const isLowPerformanceDevice = useIsLowPerformanceDevice();
  return isLowPerformanceDevice ? LoadingScreen : children;
}
