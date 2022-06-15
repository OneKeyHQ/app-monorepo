import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { BaseSkeleton, Box, IconButton, Text } from '@onekeyhq/components';
import { useOverview } from '@onekeyhq/kit/src/hooks';

import NFTList from './NFTList';

const LoadingView = () => (
  <Box borderRadius="12px" height="160px" overflow="hidden">
    <BaseSkeleton />
  </Box>
);

const Content = () => {
  const { loading } = useOverview();

  if (loading) {
    return <LoadingView />;
  }
  return (
    <Box>
      <NFTList datas={['1', '2', '3', '4', '5']} />
    </Box>
  );
};

const NFTSection: FC = () => {
  const intl = useIntl();
  return (
    <Box mb="24px">
      <Box mb="12px" flexDirection="row" justifyContent="space-between">
        <Text typography="Heading">
          {intl.formatMessage({ id: 'asset__collectibles' })}
        </Text>
        <IconButton name="ShrinkOutline" type="plain" size="sm" />
      </Box>
      <Content />
    </Box>
  );
};

export default NFTSection;
