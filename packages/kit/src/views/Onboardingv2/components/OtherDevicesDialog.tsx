import { useIntl } from 'react-intl';

import { Dialog, Image, SizableText, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ledgerLogo = require('@onekeyhq/kit/assets/pick-ledger.png');
const trezorLogo = require('@onekeyhq/kit/assets/pick-trezor.png');

function OtherDevicesDialogContent() {
  const intl = useIntl();

  return (
    <YStack>
      <Dialog.Header>
        <Dialog.Title>
          {intl.formatMessage({ id: ETranslations.pick_your_device })}
        </Dialog.Title>
      </Dialog.Header>
      <YStack pb="$2" mx="$-5">
        <ListItem
          renderAvatar={
            <Image w="$10" h="$10" borderRadius="$2" source={ledgerLogo} />
          }
          title="Ledger"
          drillIn
        />
        <ListItem
          disabled
          renderAvatar={
            <Image w="$10" h="$10" borderRadius="$2" source={trezorLogo} />
          }
          title="Trezor"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.coming_soon })}
          </SizableText>
          <ListItem.DrillIn />
        </ListItem>
      </YStack>
    </YStack>
  );
}

export function showOtherDevicesDialog() {
  Dialog.show({
    showFooter: false,
    renderContent: <OtherDevicesDialogContent />,
  });
}
