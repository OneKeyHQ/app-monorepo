import type { FC } from 'react';
import { useMemo } from 'react';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Box, Icon, Text, useIsVerticalLayout } from '@onekeyhq/components';

import useFormatDate from '../../../../hooks/useFormatDate';

import type { IBoxProps } from 'native-base';

type BackupSummaryDisplayProps = {
  backupTime: number;
  numOfHDWallets: number;
  numOfImportedAccounts: number;
  numOfWatchingAccounts: number;
  numOfContacts: number;
  size: 'normal' | 'heading';
} & IBoxProps;

const BackupSummary: FC<BackupSummaryDisplayProps> = ({
  backupTime,
  numOfHDWallets,
  numOfImportedAccounts,
  numOfWatchingAccounts,
  numOfContacts,
  size,
  ...rest
}) => {
  const isSmallScreen = useIsVerticalLayout();
  const formatDate = useFormatDate();

  const items: Array<{ iconName: ICON_NAMES; count: number }> = useMemo(
    () => [
      {
        iconName: 'WalletOutline',
        count: numOfHDWallets,
      },
      {
        iconName: 'InboxArrowDownOutline',
        count: numOfImportedAccounts,
      },
      {
        iconName: 'EyeOutline',
        count: numOfWatchingAccounts,
      },
      {
        iconName: 'BookOpenOutline',
        count: numOfContacts,
      },
    ],
    [
      numOfContacts,
      numOfHDWallets,
      numOfImportedAccounts,
      numOfWatchingAccounts,
    ],
  );

  return (
    <Box
      alignItems={size === 'heading' && isSmallScreen ? 'center' : undefined}
      {...rest}
    >
      <Text typography={size === 'heading' ? 'PageHeading' : 'Body1Strong'}>
        {formatDate.format(new Date(backupTime), 'MMM d, yyyy, HH:mm')}
      </Text>
      <Box
        flexDirection="row"
        mt={size === 'heading' ? 3 : 1}
        mx={-3}
        flexWrap="wrap"
      >
        {items.map((item, index) => (
          <Box key={index} flexDirection="row" mx={3}>
            <Icon name={item.iconName} size={20} color="icon-subdued" />
            <Text typography="Body2" color="text-subdued" pl={2}>
              {item.count}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default BackupSummary;
