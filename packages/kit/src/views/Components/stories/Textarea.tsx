import React from 'react';
import { Center, Textarea, Stack, Box, Icon, Flex } from '@onekeyhq/components';

const TextareaGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Stack space="2" minW="200">
      <Textarea />
      <Textarea isInvalid />
      <Textarea isDisabled />
      <Box>
        <Textarea />
        <Flex
          position="absolute"
          bottom={0}
          right={0}
          mr={2}
          mb={2}
          direction="row"
        >
          <Icon name="QrcodeOutline" size={14} />
          <Box ml="1">
            <Icon name="ArchiveOutline" size={14} />
          </Box>
        </Flex>
      </Box>
    </Stack>
  </Center>
);

export default TextareaGallery;
