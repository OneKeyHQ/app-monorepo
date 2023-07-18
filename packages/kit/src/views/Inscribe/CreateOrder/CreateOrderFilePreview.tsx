import type { FC } from 'react';

import { Box, Center, Image, Text, Textarea } from '@onekeyhq/components';

import type { InscribeFile } from '../Components/InscribeUploader/type';

const CreateOrderFilePreview: FC<{ file?: InscribeFile; text?: string }> = ({
  file,
  text,
}) => {
  if (!file && !text) {
    return null;
  }
  if (file) {
    if (file.type.includes('image/png') || file.type.includes('image/jpeg')) {
      return (
        <Box
          width={120}
          height={120}
          borderRadius="6px"
          bgColor="surface-default"
        >
          <Image
            resizeMethod="auto"
            resizeMode="contain"
            width={120}
            height={120}
            source={{ uri: file.dataForUI }}
          />
        </Box>
      );
    }
    return (
      <Center
        bgColor="surface-default"
        width={120}
        height={120}
        borderRadius="6px"
        px="4px"
      >
        <Text
          typography="Body2Mono"
          numberOfLines={2}
          textAlign="center"
          lineBreakMode="middle"
          color="text-disabled"
        >
          {file.type.toUpperCase()}
        </Text>
      </Center>
    );
  }
  if (text && text.length > 0) {
    return (
      <Textarea
        isDisabled
        value={text}
        width="full"
        h="96px"
        editable={false}
        _focus={{
          borderColor: 'border-default',
          bg: 'action-secondary-default',
          _hover: {
            borderColor: 'border-default',
          },
        }}
      />
    );
  }
  return null;
};

export default CreateOrderFilePreview;
