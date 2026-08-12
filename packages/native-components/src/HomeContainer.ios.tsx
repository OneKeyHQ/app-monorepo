import { memo, useMemo } from 'react';

import { callback, getHostComponent } from 'react-native-nitro-modules';

import HomeContainerConfig from '../nitrogen/generated/shared/json/HomeContainerConfig.json';

import type {
  IHomeContainerNativeMethods,
  IHomeContainerNativeProps,
  INativeHomeIntent,
  INativeHomeViewModel,
} from './HomeContainer.nitro';
import type { ViewProps } from 'react-native';

export interface IHomeContainerProps extends ViewProps {
  state: INativeHomeViewModel;
  onIntent: (intent: INativeHomeIntent) => void;
}

const HomeContainerHost = getHostComponent<
  IHomeContainerNativeProps,
  IHomeContainerNativeMethods
>('HomeContainer', () => HomeContainerConfig);

function HomeContainerView({
  state,
  onIntent,
  ...viewProps
}: IHomeContainerProps) {
  const wrappedIntent = useMemo(() => callback(onIntent), [onIntent]);
  return (
    <HomeContainerHost {...viewProps} state={state} onIntent={wrappedIntent} />
  );
}

export const HomeContainer = memo(HomeContainerView);
