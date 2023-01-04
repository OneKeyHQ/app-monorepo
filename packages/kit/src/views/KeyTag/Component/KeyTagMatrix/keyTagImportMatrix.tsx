import type { FC } from 'react';

import { Box } from '@onekeyhq/components';

import { useImportKeytagSpaceSize } from '../../hooks/useKeyTagLayout';
import DotMnemonicWord from '../DotMap/DotMnemonicWord';

import { KeyTagMatrixTopTitle } from './KeyTagMatrix';

import type { KeyTagMnemonic } from '../../types';

type KeyTagImportMatrixProps = {
  keyTagData?: KeyTagMnemonic[];
  startIndex?: number;
  onChange?: (wordIndex: number, index: number, value: boolean) => void;
  showResult?: boolean;
};

export const KeyTagImportMatrix: FC<KeyTagImportMatrixProps> = ({
  keyTagData,
  onChange,
  startIndex,
  showResult = true,
}) => {
  const { size } = useImportKeytagSpaceSize();
  return (
    <Box justifyContent="center" alignItems="center">
      <KeyTagMatrixTopTitle keyTagData={keyTagData} startIndex={startIndex} />
      <Box justifyContent="center" alignItems="center">
        {keyTagData?.map((data, i) => (
          <DotMnemonicWord
            size={size}
            key={`${i}`}
            showResult={showResult}
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
