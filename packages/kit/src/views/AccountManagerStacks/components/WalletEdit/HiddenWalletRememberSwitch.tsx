import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  IconButton,
  Popover,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function HiddenWalletRememberSwitch({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const [val, setVal] = useState(!wallet?.isTemp);
  const intl = useIntl();

  return (
    <ListItem userSelect="none" key={wallet?.id}>
      <XStack flex={1} gap="$2" alignItems="center">
        <ListItem.Text
          primary={intl.formatMessage({
            id: ETranslations.form_keep_hidden_wallet_label,
          })}
        />
        <Popover
          title={intl.formatMessage({ id: ETranslations.global_hidden_wallet })}
          placement="bottom-start"
          renderTrigger={
            <IconButton
              variant="tertiary"
              icon="InfoCircleOutline"
              size="small"
            />
          }
          renderContent={
            <YStack
              p="$5"
              pt="$0"
              $gtMd={{
                p: '$4',
              }}
            >
              <SizableText
                $gtMd={{
                  size: '$bodyMd',
                }}
              >
                {intl.formatMessage({
                  id: ETranslations.form_keep_hidden_wallet_label_desc,
                })}
              </SizableText>
            </YStack>
          }
        />
      </XStack>
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
    </ListItem>
  );
}
