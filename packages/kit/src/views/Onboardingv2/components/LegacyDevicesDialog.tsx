import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import {
  Dialog,
  DialogContainer,
  Image,
  Theme,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import { OnboardingTestIDs } from '../testIDs';

const miniImage = require('@onekeyhq/kit/assets/pick-mini.png');
const touchImage = require('@onekeyhq/kit/assets/pick-touch.png');

// Legacy entries stay full OneKey flows (firmware check included) — they only
// share the dialog-style entry point with third-party brands, never the
// vendor route.
const LEGACY_DEVICES = [
  { name: 'OneKey Mini', deviceType: EDeviceType.Mini, image: miniImage },
  { name: 'OneKey Touch', deviceType: EDeviceType.Touch, image: touchImage },
];

function LegacyDevicesDialogContent() {
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
        {LEGACY_DEVICES.map(({ name, deviceType, image }) => (
          <ListItem
            key={deviceType}
            testID={OnboardingTestIDs.pickYourDeviceLegacyOptionBtn(deviceType)}
            renderAvatar={
              <Image w="$10" h="$10" borderRadius="$2" source={image} />
            }
            title={name}
            drillIn
            onPress={async () => {
              await dialog.close();
              defaultLogger.onboarding.page.pickYourDevice(deviceType);
              navigation.push(EOnboardingPagesV2.ConnectYourDevice, {
                deviceType: [deviceType],
              });
            }}
          />
        ))}
      </YStack>
    </YStack>
  );
}

export function showLegacyDevicesDialog() {
  Dialog.show({
    // The onboarding flow is force-dark (routes/Modal/Navigator.tsx wraps it
    // in <Theme name="dark">), but Dialog.show renders into the global
    // full-window overlay portal OUTSIDE that wrapper, so by default this
    // dialog pops in the app/system (light) theme. Wrapping the whole
    // DialogContainer in <Theme name="dark"> re-themes the entire chrome
    // (card, close icon) via React context to match the onboarding flow.
    // Mirrors OtherDevicesDialog.
    dialogContainer: ({ ref }) => (
      <Theme name="dark">
        <DialogContainer
          ref={ref}
          showFooter={false}
          renderContent={<LegacyDevicesDialogContent />}
          onClose={async () => undefined}
        />
      </Theme>
    ),
  });
}
