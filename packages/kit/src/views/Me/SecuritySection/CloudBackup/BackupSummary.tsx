import type { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, ListItem, useIsVerticalLayout } from '@onekeyhq/components';

import useFormatDate from '../../../../hooks/useFormatDate';

type BackupSummaryDisplayProps = {
  backupTime: number;
  numOfHDWallets: number;
  numOfAccounts: number;
} & ComponentProps<typeof ListItem>;

const BackupSummary: FC<BackupSummaryDisplayProps> = ({
  backupTime,
  numOfHDWallets,
  numOfAccounts,
  size,
  ...rest
}) => {
  const isSmallScreen = useIsVerticalLayout();
  const formatDate = useFormatDate();
  const intl = useIntl();

  return (
    <ListItem mx={-4} {...rest}>
      <Box bgColor="surface-neutral-subdued" padding="6px" borderRadius="full">
        <Icon size={20} name="DeviceMobileOutline" />
      </Box>
      <ListItem.Column
        flex={1}
        flexDirection={isSmallScreen ? 'column' : 'row'}
        text={{
          label: formatDate.format(new Date(backupTime), 'MMM d, yyyy, HH:mm'),
          labelProps: { flex: 1, typography: 'Body1Strong' },
          description: `${intl.formatMessage(
            { id: 'form__str_wallets' },
            { 0: numOfHDWallets },
          )} · ${intl.formatMessage(
            { id: 'form__str_accounts' },
            { count: numOfAccounts },
          )}`,
        }}
      />
      <ListItem.Column
        icon={{ size: 20, name: 'ChevronRightMini', color: 'icon-subdued' }}
      />
    </ListItem>
  );
};

export default BackupSummary;
