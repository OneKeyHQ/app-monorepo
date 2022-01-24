import React, { FC } from 'react';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Box, Modal, Typography } from '@onekeyhq/components';

import { useNavigation } from '../../..';
import { BackupWalletModalRoutes, BackupWalletRoutesParams } from '../types';

export type BackupSeedHintViewProp = {
  title?: string;
  description?: string;
  onNext?: () => void;
};

type NavigationProps = NativeStackNavigationProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes
>;

const defaultProps = {
  title: 'Backup Wallet',
  description:
    'Keep your recovery seed safe. If you lose it, you will not be able to retrieve it.',
} as const;

const BackupSeedHint: FC<BackupSeedHintViewProp> = ({
  title,
  description,
  onNext,
}) => {
  console.log('route');
  console.log('BackupSeedHint');

  const navigation = useNavigation<NavigationProps>();

  return (
    <Modal
      header="BACKUP"
      hideSecondaryAction
      primaryActionTranslationId="action__continue"
      onPrimaryActionPress={() =>
        onNext
          ? onNext()
          : navigation.navigate(BackupWalletModalRoutes.BackupMnemonicsModal)
      }
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
          </Box>
        ),
      }}
    />
  );
};

BackupSeedHint.defaultProps = defaultProps;
export default BackupSeedHint;
