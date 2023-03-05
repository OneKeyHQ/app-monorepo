import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';

import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigationActions,
} from '../../../hooks';
import ExternalAccountImg from '../../../views/ExternalAccount/components/ExternalAccountImg';

import { BaseSelectorTrigger } from './BaseSelectorTrigger';

import type { INetworkAccountSelectorTriggerProps } from './BaseSelectorTrigger';

interface AccountSelectorTriggerProps
  extends INetworkAccountSelectorTriggerProps {
  showAddress?: boolean;
}

const AccountSelectorTrigger: FC<AccountSelectorTriggerProps> = ({
  showAddress = true,
  type = 'plain',
  bg,
  mode,
}) => {
  const { account } = useActiveWalletAccount();
  const { openAccountSelector } = useNavigationActions();
  const activeExternalWalletName = useAppSelector(
    (s) => s.general.activeExternalWalletName,
  );

  const intl = useIntl();
  const activeOption = useMemo(
    () => ({
      label:
        account?.name || intl.formatMessage({ id: 'empty__no_account_title' }),
      description:
        (account?.displayAddress || account?.address || '').slice(-4) || '',
      value: account?.id,
    }),
    [
      account?.displayAddress,
      account?.address,
      account?.id,
      account?.name,
      intl,
    ],
  );
  const isVertical = useIsVerticalLayout();

  return (
    <BaseSelectorTrigger
      type={type}
      bg={bg}
      icon={
        // eslint-disable-next-line no-nested-ternary
        isVertical ? null : account?.id ? (
          <ExternalAccountImg
            accountId={account?.id}
            walletName={activeExternalWalletName}
          />
        ) : null
      }
      label={activeOption.label}
      description={showAddress && activeOption.description}
      onPress={() => {
        openAccountSelector({ mode });
      }}
    />
  );
};

export { AccountSelectorTrigger };
