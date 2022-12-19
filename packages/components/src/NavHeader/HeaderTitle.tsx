import type { FC } from 'react';
import { useMemo } from 'react';

import { StyleSheet } from 'react-native';

import { useNavigation } from '@onekeyhq/kit/src/hooks';

import Box from '../Box';
import { useIsVerticalLayout } from '../Provider/hooks';
import { Text } from '../Typography';

interface TitleProps {
  title: string;
  subtitle?: string;
}

const HeaderTitle: FC<TitleProps> = ({ title, subtitle }) => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  const notFirstPage =
    navigation.getState().routes.length > 0 ? 'Heading' : 'PageHeading';

  const SmallScreenTitle = useMemo(
    () => (
      <Box
        flex={1}
        justifyContent="center"
        alignItems={notFirstPage ? 'center' : 'flex-start'}
        style={StyleSheet.absoluteFill}
        zIndex={-1}
      >
        <Text typography={notFirstPage ? 'Heading' : 'PageHeading'}>
          {title}
        </Text>
        {subtitle && (
          <Text typography="Caption" color="text-subdued">
            {subtitle}
          </Text>
        )}
      </Box>
    ),
    [notFirstPage, subtitle, title],
  );

  const LargeScreenTitle = useMemo(
    () => (
      <Box flex={1} flexDirection="row" alignItems="baseline">
        <Text typography="Heading">{title}</Text>
        {subtitle && (
          <Text typography="Body2" ml="12px" color="text-subdued">
            {subtitle}
          </Text>
        )}
      </Box>
    ),
    [subtitle, title],
  );

  return isVertical ? SmallScreenTitle : LargeScreenTitle;
};

export default HeaderTitle;
