import React, { FC } from 'react';

import ContentLoader from 'react-content-loader/native';
import { useIntl } from 'react-intl';
import { Rect } from 'react-native-svg';

import {
  Box,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import { useOverview } from '@onekeyhq/kit/src/hooks';

const LoadingView = () => {
  const isSmallScreen = useIsVerticalLayout();

  return (
    <Box borderRadius="12px" height="160px" overflow="hidden">
      <ContentLoader
        speed={1}
        width={isSmallScreen ? undefined : 'full'}
        height={isSmallScreen ? undefined : 'full'}
        backgroundColor={useThemeValue('surface-neutral-default')}
        foregroundColor={useThemeValue('surface-default')}
      >
        <Rect x="0" y="0" width="100%" height="100%" />
      </ContentLoader>
    </Box>
  );
};

const ActivitySection: FC = () => {
  const intl = useIntl();
  const { loading } = useOverview();

  return (
    <Box mb="24px">
      <Pressable mb="12px" flexDirection="row" justifyContent="space-between">
        <Text typography="Heading">
          {intl.formatMessage({ id: 'title__activity' })}
        </Text>
        <Box flexDirection="row">
          <Text typography="Button2" mr="8px" color="text-subdued">
            See All
          </Text>
          <Icon name="ChevronRightSolid" />
        </Box>
      </Pressable>
      {loading ? <LoadingView /> : <Box height="160px" bgColor="pink.500" />}
    </Box>
  );
};

export default ActivitySection;
