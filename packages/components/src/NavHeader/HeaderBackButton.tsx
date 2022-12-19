/* eslint-disable @typescript-eslint/no-use-before-define */
import type { FC } from 'react';

import { useNavigation } from '@react-navigation/core';

import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';

const HeaderBackButton: FC = () => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  return navigation.getState().routes.length > 0 ? (
    <IconButton
      type="plain"
      size="lg"
      name={isVertical ? 'ArrowLeftOutline' : 'ArrowSmallLeftOutline'}
      onPress={() => navigation.goBack()}
      circle
    />
  ) : null;
};
export default HeaderBackButton;
