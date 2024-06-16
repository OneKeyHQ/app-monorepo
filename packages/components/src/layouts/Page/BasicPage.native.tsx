import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Dimensions, type LayoutChangeEvent } from 'react-native';
import { AnimatePresence } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../../hocs';
import { Spinner, Stack, View } from '../../primitives';

import { useTabBarHeight } from './hooks';

import type { IBasicPageProps } from './type';

function Loading() {
  return (
    <Stack flex={1} alignContent="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

// On iOS, in the tab container, when initializing the page,
//  the elements cannot fill the container space, so a minimum height needs to be set
const useMinHeight = () => {
  const pageType = usePageType();
  const tabHeight = useTabBarHeight();
  if (!platformEnv.isNativeIOS) {
    return undefined;
  }
  if (pageType !== EPageType.modal) {
    return Dimensions.get('window').height - tabHeight;
  }
  return undefined;
};

function LoadingScreen({ children }: PropsWithChildren<unknown>) {
  const [showLoading, changeLoadingVisibleStatus] = useState(true);
  const [showChildren, changeChildrenVisibleStatus] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      changeChildrenVisibleStatus(true);
      setTimeout(() => {
        changeLoadingVisibleStatus(false);
      }, 0);
    }, 0);
  }, []);

  const minHeight = useMinHeight();
  return (
    <View flex={1} minHeight={minHeight}>
      {showChildren ? children : null}
      <AnimatePresence>
        {showLoading ? (
          <Stack
            bg="$bgApp"
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            opacity={1}
            flex={1}
            animation="quick"
            exitStyle={{
              opacity: 0,
            }}
          >
            <Loading />
          </Stack>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

export function BasicPage({ children, skipLoading = false }: IBasicPageProps) {
  return (
    <Stack bg="$bgApp" flex={1}>
      {skipLoading ? children : <LoadingScreen>{children}</LoadingScreen>}
    </Stack>
  );
}
