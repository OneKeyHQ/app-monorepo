import { Box, Center, Icon, Stack, Textarea } from '@onekeyhq/components';

const TextareaGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Stack space="2" minW="200">
      <Textarea />
      <Textarea isInvalid />
      <Textarea isDisabled />
      <Box>
        <Textarea />
        <Box
          position="absolute"
          bottom={0}
          right={0}
          mr={2}
          mb={2}
          display="flex"
          flexDirection="row"
        >
          <Icon name="QrCodeOutline" size={14} />
          <Box ml="1">
            <Icon name="ArchiveOutline" size={14} />
          </Box>
        </Box>
      </Box>
    </Stack>
  </Center>
);

export default TextareaGallery;
