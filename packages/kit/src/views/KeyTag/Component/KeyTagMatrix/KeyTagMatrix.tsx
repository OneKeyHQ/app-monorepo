import { FC } from 'react';

import { Box, Typography } from '@onekeyhq/components';

import { KeyTagMnemonic } from '../../types';
import DotMnemonicWord from '../DotMap/DotMnemonicWord';

type KeyTagMatrixProps = {
  keyTagData?: KeyTagMnemonic[];
};

export const KeyTagMatrix: FC<KeyTagMatrixProps> = ({ keyTagData }) => {
  console.log('KeyTagMatrix');
  // const tagData = mnemonicWordsToKeyTagData(fackData);
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

      <Box
        borderColor="surface-default"
        borderWidth="8px"
        borderRadius="16px"
        bgColor="surface-subdued"
        // justifyContent="center"
        alignItems="center"
        pt={6}
        w="332px"
        h="343px"
      >
        <Box>
          {keyTagData
            ? keyTagData.map((data, index) => (
                <DotMnemonicWord
                  showDigitCode={index === 0}
                  showIcon={index === 0}
                  mnemonicWordData={data}
                  disabled
                />
              ))
            : null}
        </Box>
      </Box>
    </Box>
  );
};
