import { FC } from 'react';

import { Box, Typography } from '@onekeyhq/components';

import { KeyTagMnemonic } from '../../types';
import DotMnemonicWord from '../DotMap/DotMnemonicWord';

type KeyTagImportMatrixProps = {
  keyTagData?: KeyTagMnemonic[];
  onChange?: (wordIndex: number, index: number, value: boolean) => void;
};

export const KeyTagImportMatrix: FC<KeyTagImportMatrixProps> = ({
  keyTagData,
  onChange,
}) => {
  console.log('KeyTagImportMatrix--');
  return (
    <Box flex="1" justifyContent="center" alignItems="center">
      <Box
        mt={14}
        mb={4}
        w="full"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        <Typography.Heading>Front</Typography.Heading>
        <Typography.Body2>#1 - #12</Typography.Body2>
      </Box>
      <Box justifyContent="center" alignItems="center">
        {keyTagData?.map((data, i) => (
          <DotMnemonicWord
            key={`${i}`}
            showWordStatus
            mnemonicWordData={data}
            onChange={(index, value) => {
              if (onChange) {
                onChange(data.index, index, value);
              }
            }}
          />
        ))}
      </Box>
    </Box>
  );
};
