import { FC } from 'react';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useWebController } from '../Controller/useWebController';

const ControllerBarMobile: FC<{
  expandAnim: Animated.SharedValue<number>;
}> = ({ expandAnim }) => {
  const {
    openMatchDApp,
    gotoSite,
    currentTab,
    stopLoading,
    goBack,
    goForward,
    reload,
  } = useWebController();
  const { loading, canGoBack, canGoForward } = currentTab;
  return (
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          opacity: expandAnim.value,
          display: expandAnim.value === FLOATINGWINDOW_MIN ? 'none' : 'flex',
        }),
        [],
      )}
    >
      <AddressBar onSearch={onSearch} />
    </Animated.View>
  );
};
