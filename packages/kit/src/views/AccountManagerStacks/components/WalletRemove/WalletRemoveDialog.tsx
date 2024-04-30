import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

export function WalletRemoveDialog({
  defaultValue,
  wallet,
  showCheckBox,
}: {
  defaultValue: boolean;
  wallet?: IDBWallet;
  showCheckBox: boolean;
}) {
  const [value, changeValue] = useState(defaultValue);
  const handleChange = useCallback((checked: ICheckedState) => {
    changeValue(!!checked);
  }, []);
  const actions = useAccountSelectorActions();
  return (
    <>
      {showCheckBox ? (
        <Checkbox
          value={value}
          onChange={handleChange}
          label="I've written down the recovery phrase"
        />
      ) : null}
      <Dialog.Footer
        onConfirmText="Remove"
        confirmButtonProps={{
          disabled: showCheckBox && !value,
          variant: 'destructive',
        }}
        onConfirm={async () => {
          await actions.current.removeWallet({
            walletId: wallet?.id || '',
          });
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
  showCheckBox,
}: {
  defaultChecked: boolean;
  title: string;
  description: string;
  wallet?: IDBWallet;
  config: IAccountSelectorContextData | undefined;
  showCheckBox: boolean;
}) {
  return Dialog.show({
    icon: 'ErrorOutline',
    tone: 'destructive',
    title,
    description,
    renderContent: config ? (
      <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
        <WalletRemoveDialog
          wallet={wallet}
          defaultValue={defaultChecked}
          showCheckBox={showCheckBox}
        />
      </AccountSelectorProviderMirror>
    ) : null,
  });
}
