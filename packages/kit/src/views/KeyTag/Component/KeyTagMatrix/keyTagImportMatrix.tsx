import type { FC } from 'react';

import { Box } from '@onekeyhq/components';

import DotMnemonicWord from '../DotMap/DotMnemonicWord';

import { KeyTagMatrixTopTitle } from './KeyTagMatrix';

import type { KeyTagMnemonic } from '../../types';

type KeyTagImportMatrixProps = {
  keyTagData?: KeyTagMnemonic[];
  startIndex?: number;
  onChange?: (wordIndex: number, index: number, value: boolean) => void;
};

export const KeyTagImportMatrix: FC<KeyTagImportMatrixProps> = ({
  keyTagData,
  onChange,
  startIndex,
}) => {
  console.log('KeyTagImportMatrix--');
  return (
    <Box justifyContent="center" alignItems="center">
      <KeyTagMatrixTopTitle keyTagData={keyTagData} startIndex={startIndex} />
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
