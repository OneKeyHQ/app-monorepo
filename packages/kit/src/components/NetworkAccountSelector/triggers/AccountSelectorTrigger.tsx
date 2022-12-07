import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigationActions } from '../../../hooks';

import {
  BaseSelectorTrigger,
  INetworkAccountSelectorTriggerProps,
} from './BaseSelectorTrigger';

function AccountSelectorTrigger({
  type = 'plain',
  size = 'sm',
  bg,
  mode,
}: INetworkAccountSelectorTriggerProps) {
  const { account } = useActiveWalletAccount();
  const { openAccountSelector } = useNavigationActions();
  const intl = useIntl();
  const activeOption = useMemo(
    () => ({
      label:
        account?.name || intl.formatMessage({ id: 'empty__no_account_title' }),
      value: account?.id,
    }),
    [account?.id, account?.name, intl],
  );
  const isVertical = useIsVerticalLayout();

  return (
    <BaseSelectorTrigger
      type={type}
      size={size}
      bg={bg}
      icon={isVertical ? null : <Box position="relative">ICON</Box>}
      label={activeOption.label}
      onPress={() => {
        openAccountSelector({ mode });
      }}
    />
  );
}

export { AccountSelectorTrigger };
