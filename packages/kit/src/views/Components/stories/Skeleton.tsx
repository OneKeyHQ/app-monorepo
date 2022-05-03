import React from 'react';

import { Box, Skeleton, Typography } from '@onekeyhq/components';

const SkeletonGallery = () => (
  <Box bgColor="background-default" flex={1}>
    <Box w={768} mx="auto">
      <Box py={8}>
        <Skeleton ele="Avatar" size={48} />
        <Skeleton ele="DisplayXLarge" />
        <Skeleton ele="PageHeading" />
        <Skeleton ele="DisplayLarge" />
        <Skeleton ele="DisplayMedium" />
        <Skeleton ele="Heading" />
        <Skeleton ele="DisplaySmall" />
        <Skeleton ele="Body1" />
        <Skeleton ele="Body2" />
        <Skeleton ele="Caption" />
        <Skeleton ele="Subheading" />
        <Skeleton>
          <Skeleton.Avatar />
          <Skeleton.Body1 x={40} />
          <Skeleton.Body2 x={40} y={24} />
        </Skeleton>
      </Box>
    </Box>
  </Box>
);

export default SkeletonGallery;
