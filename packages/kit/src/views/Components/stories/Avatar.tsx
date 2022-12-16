import { Avatar, Box, Center } from '@onekeyhq/components';

const AddressGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Box my="2">
      <Avatar address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48" size={16} />
    </Box>
    <Box my="2">
      <Avatar address="0x4321B96Cde5bf063F21978870fF193Ae8cae1234" size={32} />
    </Box>
    <Box my="2">
      <Avatar address="0x1234B96Cde5bf063F21978870fF193Ae8cae4321" size={48} />
    </Box>
  </Center>
);

export default AddressGallery;
