import { useState } from 'react';

import { Switch } from '@onekeyhq/components';
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
      icon="InfoCircleOutline"
      label="Always Remember this Hidden Wallet."
      drillIn={false}
    >
      <Switch
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
  // return (
  //   <Stack flexDirection="row" alignItems="center" space="$2">
  //     <Switch
  //       value={val}
  //       onChange={() => {
  //         setVal(!val);
  //       }}
  //     />
  //     <SizableText>Always Remember this Hidden Wallet. </SizableText>
  //   </Stack>
  // );
}
