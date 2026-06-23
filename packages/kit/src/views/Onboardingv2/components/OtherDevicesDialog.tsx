import { useIntl } from 'react-intl';

import { Dialog, Image, YStack, useDialogInstance } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

const ledgerLogo = require('@onekeyhq/kit/assets/pick-ledger.png');
const trezorLogo = require('@onekeyhq/kit/assets/pick-trezor.png');

function OtherDevicesDialogContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const dialog = useDialogInstance();

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
          onPress={async () => {
            await dialog.close();
            defaultLogger.onboarding.page.pickYourDevice(
              EHardwareVendor.ledger,
            );
            navigation.push(EOnboardingPagesV2.ConnectYourDevice, {
              deviceType: [],
              vendor: EHardwareVendor.ledger,
            });
          }}
        />
        <ListItem
          renderAvatar={
            <Image w="$10" h="$10" borderRadius="$2" source={trezorLogo} />
          }
          title="Trezor"
          drillIn
          onPress={async () => {
            await dialog.close();
            defaultLogger.onboarding.page.pickYourDevice(
              EHardwareVendor.trezor,
            );
            navigation.push(EOnboardingPagesV2.ConnectYourDevice, {
              deviceType: [],
              vendor: EHardwareVendor.trezor,
            });
          }}
        />
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
