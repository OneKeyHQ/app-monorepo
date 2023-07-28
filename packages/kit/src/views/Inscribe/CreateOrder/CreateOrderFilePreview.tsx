import type { FC } from 'react';

import { Box, Center, Image, ScrollView, Text } from '@onekeyhq/components';

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
      <ScrollView
        backgroundColor="action-secondary-default"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        borderRadius="12px"
        h="96px"
        borderColor="border-default"
        borderWidth={1}
      >
        <Text typography="Body2Mono" color="text-subdued">
          {text}
        </Text>
      </ScrollView>
    );
  }
  return null;
};

export default CreateOrderFilePreview;
