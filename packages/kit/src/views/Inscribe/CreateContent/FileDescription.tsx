import type { FC } from 'react';

import { HStack, Icon, Text } from '@onekeyhq/components';

import { formatBytes } from '../../../utils/hardware/homescreens';

import type { InscribeFile } from '../Components/InscribeUploader/type';

const FileDescription: FC<{
  file?: InscribeFile;
  optimize?: boolean;
  error: string;
}> = ({ file }) => {
  if (!file) {
    return null;
  }

  return (
    <HStack mt="8px" justifyContent="space-between" alignItems="center">
      <HStack space="4px" alignItems="center">
        <Icon size={16} name="PhotoMini" />
        <Text typography="Caption" color="text-subdued">
          {file.type.toUpperCase()}
        </Text>
      </HStack>
      {file.size && <Text typography="Caption">{formatBytes(file.size)}</Text>}
    </HStack>
  );
};

export default FileDescription;
