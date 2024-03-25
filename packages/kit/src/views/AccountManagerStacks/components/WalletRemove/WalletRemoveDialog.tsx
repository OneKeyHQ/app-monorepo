import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  ETrackEventNames,
  trackEvent,
} from '@onekeyhq/shared/src/modules3rdParty/mixpanel';

export function WalletRemoveDialog({
  defaultValue,
  wallet,
}: {
  defaultValue: boolean;
  wallet?: IDBWallet;
}) {
  const [value, changeValue] = useState(defaultValue);
  const handleChange = useCallback((checked: ICheckedState) => {
    changeValue(!!checked);
  }, []);
  const actions = useAccountSelectorActions();
  return (
    <>
      <Checkbox
        value={value}
        onChange={handleChange}
        label="I've written down the recovery phrase"
      />

      <Dialog.Footer
        onConfirmText="Remove"
        confirmButtonProps={{
          disabled: !value,
          variant: 'destructive',
        }}
        onConfirm={async () => {
          await actions.current.removeWallet({
            walletId: wallet?.id || '',
          });
          trackEvent(ETrackEventNames.DeleteWallet);
        }}
      />
    </>
  );
}

export function showWalletRemoveDialog({
  title,
  description,
  defaultChecked,
  wallet,
  config,
}: {
  defaultChecked: boolean;
  title: string;
  description: string;
  wallet?: IDBWallet;
  config: IAccountSelectorContextData | undefined;
}) {
  return Dialog.show({
    icon: 'ErrorOutline',
    tone: 'destructive',
    title,
    description,
    renderContent: config ? (
      <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
        <WalletRemoveDialog wallet={wallet} defaultValue={defaultChecked} />
      </AccountSelectorProviderMirror>
    ) : null,
  });
}
