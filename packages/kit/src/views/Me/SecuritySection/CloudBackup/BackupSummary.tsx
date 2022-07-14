import React, { FC } from 'react';

import { Box, Icon, Text, useIsVerticalLayout } from '@onekeyhq/components';

import useFormatDate from '../../../../hooks/useFormatDate';

type BackupSummaryDisplayProps = {
  backupTime: number;
  numOfHDWallets: number;
  numOfImportedAccounts: number;
  numOfWatchingAccounts: number;
  numOfContacts: number;
  size: 'normal' | 'heading';
};

const BackupSummary: FC<BackupSummaryDisplayProps> = ({
  backupTime,
  numOfHDWallets,
  numOfImportedAccounts,
  numOfWatchingAccounts,
  numOfContacts,
  size,
}) => {
  const isSmallScreen = useIsVerticalLayout();
  const formatDate = useFormatDate();

  const dateTypography = size === 'heading' ? 'PageHeading' : 'Body1Strong';
  const numberTypography = size === 'heading' ? 'Body2Strong' : 'CaptionStrong';
  const iconSize = size === 'heading' ? 20 : 16;
  const alignment = size === 'heading' && isSmallScreen ? 'center' : undefined;
  const pl = size === 'heading' ? 2 : 1;
  const pr = size === 'heading' ? 4 : 3;

  return (
    <Box alignItems={alignment}>
      <Text my="1" typography={dateTypography}>
        {formatDate.format(new Date(backupTime), 'MMM d, yyyy, HH:mm')}
      </Text>
      <Box
        my="1"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Icon name="WalletOutline" size={iconSize} />
        <Text
          typography={numberTypography}
          color="text-subdued"
          pl={pl}
          pr={pr}
        >
          {numOfHDWallets}
        </Text>
        <Icon name="SaveOutline" size={iconSize} />
        <Text
          typography={numberTypography}
          color="text-subdued"
          pl={pl}
          pr={pr}
        >
          {numOfImportedAccounts}
        </Text>
        <Icon name="EyeOutline" size={iconSize} />
        <Text
          typography={numberTypography}
          color="text-subdued"
          pl={pl}
          pr={pr}
        >
          {numOfWatchingAccounts}
        </Text>
        <Icon name="BookOpenOutline" size={iconSize} />
        <Text typography={numberTypography} color="text-subdued" pl={pl}>
          {numOfContacts}
        </Text>
      </Box>
    </Box>
  );
};

export default BackupSummary;
