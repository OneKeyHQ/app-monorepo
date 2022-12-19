/* eslint-disable @typescript-eslint/no-use-before-define */
import type { ComponentProps, FC } from 'react';

import { useNavigation } from '@react-navigation/core';

import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';

const HeaderBackButton: FC<ComponentProps<typeof IconButton>> = ({
  ...rest
}) => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  return navigation.getState().routes.length > 0 ? (
    <IconButton
      type="plain"
      size="lg"
      name={isVertical ? 'ArrowLeftOutline' : 'ArrowSmallLeftOutline'}
      onPress={() => navigation.goBack()}
      circle
      {...rest}
    />
  ) : null;
};
export default HeaderBackButton;
