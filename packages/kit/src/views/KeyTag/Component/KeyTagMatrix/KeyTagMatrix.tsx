import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';

import DotMnemonicWord from '../DotMap/DotMnemonicWord';

import type { KeyTagMnemonic } from '../../types';

type KeyTagMatrixProps = {
  keyTagData?: KeyTagMnemonic[];
  startIndex?: number;
};

export const KeyTagMatrixTopTitle: FC<KeyTagMatrixProps> = ({
  keyTagData,
  startIndex,
}) => {
  const intl = useIntl();
  const title = useMemo(() => {
    if (startIndex && startIndex > 1) {
      return intl.formatMessage({ id: 'form__back' });
    }
    return intl.formatMessage({ id: 'form__front' });
  }, [intl, startIndex]);
  const sequenceRange = useMemo(
    () =>
      `#${startIndex ?? 1}-#${
        (keyTagData?.length ?? 0) + (startIndex ?? 1) - 1
      }`,
    [startIndex, keyTagData],
  );
  return (
    <Box
      mt={4}
      mb={4}
      w="full"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Typography.Heading>{title}</Typography.Heading>
      <Typography.Body2>{sequenceRange}</Typography.Body2>
    </Box>
  );
};

export const KeyTagMatrix: FC<KeyTagMatrixProps> = ({
  startIndex,
  keyTagData,
}) => (
  <Box flex="1" justifyContent="center" alignItems="center">
    <KeyTagMatrixTopTitle startIndex={startIndex} keyTagData={keyTagData} />
    <Box
      borderColor="surface-default"
      borderWidth="8px"
      borderRadius="16px"
      bgColor="surface-subdued"
      alignItems="center"
      pt={4}
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
