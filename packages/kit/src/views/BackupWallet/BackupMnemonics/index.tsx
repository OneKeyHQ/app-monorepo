import React, { FC } from 'react';

import { Box, Modal, Typography } from '@onekeyhq/components';

export type BackupMnemonicsViewProp = {
  title?: string;
  description?: string;
  mnemonic?: string[];
  onNext?: () => void;
};

const DATA_MNEMONIC = [
  'mandate',
  'bottom',
  'build',
  'cement',
  'despair',
  'elephant',
  'tank',
  'destroy',
  'typical',
  'cinnamon',
  'draw',
  'first',
];

const defaultProps = {
  title: 'Backup Wallet',
  mnemonic: DATA_MNEMONIC,
  description:
    'Keep your recovery seed safe. If you lose it, you will not be able to retrieve it.',
} as const;

const Mnemonic: FC<{ index: number; word: string }> = ({ index, word }) => (
  <Box flexDirection="row" mt={1} mb={1}>
    <Typography.Body1Strong minW={8} color="text-subdued">
      {`${index}.`}
    </Typography.Body1Strong>
    <Typography.DisplaySmall color="text-default">
      {word}
    </Typography.DisplaySmall>
  </Box>
);

const BackupMnemonics: FC<BackupMnemonicsViewProp> = ({
  title,
  mnemonic,
  description,
}) => {
  console.log('mnemonic:', mnemonic);

  const halfWayThough = Math.floor((mnemonic?.length ?? 0) / 2);

  const arrayLeftHalf = mnemonic?.slice(0, halfWayThough);
  const arrayRightHalf = mnemonic?.slice(halfWayThough, mnemonic?.length ?? 0);

  return (
    <Modal
      header="BACKUP"
      hideSecondaryAction
      primaryActionTranslationId="action__done"
      onPrimaryActionPress={({ onClose }) => onClose?.()}
      scrollViewProps={{
        children: (
          <Box alignItems="center" flex={1}>
            <Typography.DisplayXLarge
              mt={8}
              mx={9}
              color="text-default"
              textAlign="center"
            >
              {title}
            </Typography.DisplayXLarge>
            <Typography.Body1
              mt={2}
              mx={9}
              color="text-subdued"
              textAlign="center"
            >
              {description}
            </Typography.Body1>

            <Box
              mx={9}
              mt={5}
              p={4}
              flexDirection="row"
              bg="surface-default"
              borderRadius="12px"
            >
              <Box flex={1}>
                {arrayLeftHalf?.map((word, index) => (
                  <Mnemonic index={index + 1} word={word} />
                ))}
              </Box>
              <Box flex={1}>
                {arrayRightHalf?.map((word, index) => (
                  <Mnemonic index={index + halfWayThough + 1} word={word} />
                ))}
              </Box>
            </Box>
          </Box>
        ),
      }}
    />
  );
};

BackupMnemonics.defaultProps = defaultProps;
export default BackupMnemonics;
