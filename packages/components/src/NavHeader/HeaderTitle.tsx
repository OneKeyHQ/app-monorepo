import { FC } from 'react';

import { StyleSheet } from 'react-native';

import { useNavigation } from '@onekeyhq/kit/src/hooks';

import Box from '../Box';
import { useIsVerticalLayout } from '../Provider/hooks';
import Typography from '../Typography';

interface TitleProps {
  title: string;
  subtitle?: string;
}

const HeaderTitle: FC<TitleProps> = ({ title, subtitle }) => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();
  return isVertical && navigation.canGoBack() ? (
    <Box
      flex={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      style={StyleSheet.absoluteFill}
      zIndex={-1}
    >
      <Typography.PageHeading fontSize="18px">{title}</Typography.PageHeading>
      {subtitle && (
        <Typography.Caption fontSize="12px" color="text-subdued">
          {subtitle}
        </Typography.Caption>
      )}
    </Box>
  ) : (
    <Box flex={1} flexDirection="row" alignItems="center">
      <Typography.PageHeading fontSize="18px">{title}</Typography.PageHeading>
      {subtitle && (
        <Typography.Body2 fontSize="14px" ml="12px" color="text-subdued">
          {subtitle}
        </Typography.Body2>
      )}
    </Box>
  );
};

export default HeaderTitle;
