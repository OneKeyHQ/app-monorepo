import type { FC } from 'react';

import { HStack, Icon, Text } from '@onekeyhq/components';

import { formatBytes } from '../../../utils/hardware/homescreens';

import type { InscribeFile } from '../Components/InscribeUploader/type';

const FileDescription: FC<{ file?: InscribeFile; optimize?: boolean }> = ({
  file,
}) => {
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
      <Text typography="Caption">
        {formatBytes(file.size)}
        {/* 59.23 KB 12.39 KB • 79.08% Saved */}
      </Text>
    </HStack>
  );
};

export default FileDescription;
