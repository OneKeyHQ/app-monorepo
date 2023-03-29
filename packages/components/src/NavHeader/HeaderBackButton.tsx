/* eslint-disable @typescript-eslint/no-use-before-define */
import type { FC } from 'react';

import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';
import { getAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { navigationShortcuts } from '@onekeyhq/kit/src/routes/navigationShortcuts';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const HeaderBackButton: FC<{ navigation?: NativeStackNavigationProp<any> }> = ({
  navigation = getAppNavigation(),
}) => {
  const isVertical = useIsVerticalLayout();
  return (
    <IconButton
      type="plain"
      size="lg"
      name={isVertical ? 'ArrowLeftOutline' : 'ArrowSmallLeftOutline'}
      onPress={() => {
        if (navigation?.canGoBack()) {
          navigation?.goBack();
        } else {
          navigationShortcuts.navigateToHome();
        }
      }}
      circle
    />
  );
};
export default HeaderBackButton;
