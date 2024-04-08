import { useState } from 'react';

import { ESwitchSize, Switch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { WalletOptionItem } from './WalletOptionItem';

export function HiddenWalletRememberSwitch({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const [val, setVal] = useState(!wallet?.isTemp);
  return (
    <WalletOptionItem
      label="Keep Accessible"
      description="Hidden wallets clear on app close. Toggle to preserve."
      drillIn={false}
    >
      <Switch
        size={ESwitchSize.small}
        value={val}
        onChange={async () => {
          if (!wallet?.id) {
            return;
          }
          const newVal = !val;
          try {
            await backgroundApiProxy.serviceAccount.setWalletTempStatus({
              walletId: wallet?.id,
              isTemp: !newVal,
            });
            setVal(newVal);
          } catch (error) {
            setVal(val);
            throw error;
          }
        }}
      />
    </WalletOptionItem>
  );
}
