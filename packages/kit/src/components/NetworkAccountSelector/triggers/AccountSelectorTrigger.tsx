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

  const { accountIndex } = useAppSelector((s) => s.allNetworks);

  const intl = useIntl();

  const allNetworkAccountInfo = useMemo(
    () => ({
      label:
        typeof accountIndex !== 'undefined'
          ? `Account #${accountIndex + 1}`
          : intl.formatMessage({ id: 'empty__no_account_title' }),
      description: '',
      value: accountIndex,
    }),
    [intl, accountIndex],
  );

  const activeOption = useMemo(() => {
    if (isAllNetworks(networkId)) {
      return allNetworkAccountInfo;
    }
    return {
      label:
        account?.name || intl.formatMessage({ id: 'empty__no_account_title' }),
      description:
        (account?.displayAddress || account?.address || '').slice(-4) || '',
      value: account?.id,
    };
  }, [
    account?.displayAddress,
    account?.address,
    account?.id,
    account?.name,
    intl,
    networkId,
    allNetworkAccountInfo,
  ]);
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
