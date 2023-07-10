import type { FC } from 'react';

import { Box, Center, Image, Text } from '@onekeyhq/components';

import { formatBytes } from '../../../../utils/hardware/homescreens';

import type { InscribeFile } from '../InscribeUploader/type';

export const InscribeFilePreview: FC<{ file: InscribeFile }> = ({ file }) => {
  if (file.type.includes('image/png') || file.type.includes('image/jpeg')) {
    return (
      <Box w="full" h="full">
        <Image
          resizeMethod="auto"
          resizeMode="cover"
          width={366}
          height={148}
          source={{ uri: file.dataForUI }}
        />
      </Box>
    );
  }
  return (
    <Center padding="16px" width="full" height="full">
      <Text
        typography="Body1Strong"
        numberOfLines={2}
        textAlign="center"
        lineBreakMode="middle"
      >
        {file.name}
      </Text>
      {file.size && <Text typography="Caption">{formatBytes(file.size)}</Text>}
    </Center>
  );
};
