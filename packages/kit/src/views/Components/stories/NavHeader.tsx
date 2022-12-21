/* eslint-disable react/no-unstable-nested-components */
import { Box, IconButton } from '@onekeyhq/components';
import NavHeader from '@onekeyhq/components/src/NavHeader/NavHeader';

const NavHeaderGallery = () => (
  <Box p="20px">
    <Box bg="surface-selected">
      <NavHeader title="Title" safeTop={0} />
    </Box>
    <Box h="20px" />
    <Box bg="surface-selected">
      <NavHeader
        safeTop={0}
        title="TitleWithOutBackButton"
        subtitle="subtitle"
        enableBackButton={false}
      />
    </Box>
    <Box h="20px" />
    <Box bg="surface-selected">
      <NavHeader
        safeTop={0}
        title="Title"
        subtitle="subtitle"
        headerRight={() => (
          <IconButton
            name="EllipsisVerticalOutline"
            size="lg"
            type="plain"
            circle
            mr={-1.5}
          />
        )}
      />
    </Box>
  </Box>
);

export default NavHeaderGallery;
