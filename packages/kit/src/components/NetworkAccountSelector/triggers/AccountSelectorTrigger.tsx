import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

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
  const { account, networkId } = useActiveWalletAccount();
  const { openAccountSelector } = useNavigationActions();
  const activeExternalWalletName = useAppSelector(
    (s) => s.general.activeExternalWalletName,
  );

  const intl = useIntl();

  const activeOption = useMemo(
    () => ({
      label:
        account?.name || intl.formatMessage({ id: 'empty__no_account_title' }),
      description: isAllNetworks(networkId)
        ? ''
        : (account?.displayAddress || account?.address || '').slice(-4) || '',
      value: account?.id,
    }),
    [
      account?.displayAddress,
      account?.address,
      account?.id,
      account?.name,
      intl,
      networkId,
    ],
  );
  const isVertical = useIsVerticalLayout();

  const icon = useMemo(() => {
    if (isVertical) {
      return null;
    }
    if (!account?.id) {
      return null;
    }
    return (
      <ExternalAccountImg
        accountId={account?.id}
        walletName={activeExternalWalletName}
      />
    );
  }, [isVertical, account, activeExternalWalletName]);

  return (
    <BaseSelectorTrigger
      type={type}
      bg={bg}
      icon={icon}
      label={activeOption.label}
      description={showAddress && activeOption.description}
      onPress={() => {
        openAccountSelector({ mode });
      }}
    />
  );
};

export { AccountSelectorTrigger };
