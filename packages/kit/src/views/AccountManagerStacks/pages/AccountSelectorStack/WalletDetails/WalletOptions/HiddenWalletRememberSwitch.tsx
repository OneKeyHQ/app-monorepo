import { useState } from 'react';

import { useIntl } from 'react-intl';

import { ESwitchSize, Switch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletOptionItem } from './WalletOptionItem';

export function HiddenWalletRememberSwitch({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const [val, setVal] = useState(!wallet?.isTemp);
  const intl = useIntl();

  return (
    <WalletOptionItem
      key={wallet?.id}
      label={intl.formatMessage({
        id: ETranslations.form_keep_hidden_wallet_label,
      })}
      description={intl.formatMessage({
        id: ETranslations.form_keep_hidden_wallet_label_desc,
      })}
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
