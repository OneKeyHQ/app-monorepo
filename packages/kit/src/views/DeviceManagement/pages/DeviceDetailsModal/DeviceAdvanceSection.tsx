import { useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Switch, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

function DeviceAdvanceSection({ data }: { data: IHwQrWalletWithDevice }) {
  const intl = useIntl();
  const [passphraseEnabled, setPassphraseEnabled] = useState(false);
  const [pinOnAppEnabled, setPinOnAppEnabled] = useState(false);

  return (
    <YStack gap="$1">
      <XStack ai="center" h="$9">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_advance,
          })}
        </SizableText>
      </XStack>
      <YStack py="$1" bg="$bgSubdued" borderRadius="$4">
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.global_passphrase,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.global_passphrase_desc,
          })}
        >
          <Switch
            size="small"
            value={passphraseEnabled}
            onChange={() => {
              setPassphraseEnabled(!passphraseEnabled);
            }}
          />
        </ListItem>
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.enter_pin_on_app,
          })}
        >
          <Switch
            size="small"
            value={pinOnAppEnabled}
            onChange={() => {
              setPinOnAppEnabled(!pinOnAppEnabled);
            }}
          />
        </ListItem>
      </YStack>
    </YStack>
  );
}

export default DeviceAdvanceSection;
