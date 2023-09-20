import { Badge, Box, Center } from '@onekeyhq/components';

const BadgeGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Box margin="10px">
      <Badge title="Success" size="lg" type="success" />
    </Box>

    <Box margin="10px">
      <Badge title="Info" size="lg" type="info" />
    </Box>

    <Box margin="10px">
      <Badge title="Warning" size="sm" type="warning" />
    </Box>

    <Box margin="10px">
      <Badge title="Default" size="sm" type="default" />
    </Box>

    <Box margin="10px">
      <Badge title="Default" size="sm" type="critical" />
    </Box>
  </Center>
);

export default BadgeGallery;
