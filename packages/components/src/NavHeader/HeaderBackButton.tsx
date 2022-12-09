/* eslint-disable @typescript-eslint/no-use-before-define */
import { FC } from 'react';

import { useNavigation } from '@react-navigation/core';

import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';

const HeaderBackButton: FC = () => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  return navigation.canGoBack() ? (
    <IconButton
      type="plain"
      name={isVertical ? 'ChevronLeftSolid' : 'ArrowLeftSolid'}
      onPress={() => navigation.goBack()}
    />
  ) : null;
};
export default HeaderBackButton;
