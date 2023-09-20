import { Box, Skeleton } from '@onekeyhq/components';

const SkeletonGallery = () => (
  <Box bgColor="background-default" flex={1}>
    <Box w={768} mx="auto">
      <Box py={8}>
        <Skeleton shape="Avatar" size={48} />
        <Skeleton shape="DisplayXLarge" />
        <Skeleton shape="PageHeading" />
        <Skeleton shape="DisplayLarge" />
        <Skeleton shape="DisplayMedium" />
        <Skeleton shape="Heading" />
        <Skeleton shape="DisplaySmall" />
        <Skeleton shape="Body1" />
        <Skeleton shape="Body2" />
        <Skeleton shape="Caption" />
        <Skeleton shape="Subheading" />
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
