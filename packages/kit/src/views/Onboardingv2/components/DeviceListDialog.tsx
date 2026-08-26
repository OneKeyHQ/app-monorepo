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
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { EDeviceType } from '@onekeyfe/hd-shared';

export type IDeviceListDialogItem = {
  title: string;
  image: ReturnType<typeof require>;
  testID?: string;
  /** Doubles as the pickYourDevice analytics label. */
  logKey: string;
  routeParams: {
    deviceType: EDeviceType[];
    vendor?: EHardwareVendor;
  };
};

function DeviceListDialogContent({
  items,
}: {
  items: IDeviceListDialogItem[];
}) {
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
        {items.map(({ title, image, testID, logKey, routeParams }) => (
          <ListItem
            key={logKey}
            testID={testID}
            renderAvatar={
              <Image w="$10" h="$10" borderRadius="$2" source={image} />
            }
            title={title}
            drillIn
            onPress={async () => {
              await dialog.close();
              defaultLogger.onboarding.page.pickYourDevice(logKey);
              navigation.push(
                EOnboardingPagesV2.ConnectYourDevice,
                routeParams,
              );
            }}
          />
        ))}
      </YStack>
    </YStack>
  );
}

/** The "pick a device model" list dialog shared by the Legacy and
 * third-party entry cards. */
export function showDeviceListDialog(items: IDeviceListDialogItem[]) {
  Dialog.show({
    // The onboarding flow is force-dark (routes/Modal/Navigator.tsx wraps it
    // in <Theme name="dark">), but Dialog.show renders into the global
    // full-window overlay portal OUTSIDE that wrapper, so by default this
    // dialog pops in the app/system (light) theme. Wrapping the whole
    // DialogContainer in <Theme name="dark"> re-themes the entire chrome
    // (card, close icon) via React context to match the onboarding flow.
    dialogContainer: ({ ref }) => (
      <Theme name="dark">
        <DialogContainer
          ref={ref}
          showFooter={false}
          renderContent={<DeviceListDialogContent items={items} />}
          onClose={async () => undefined}
        />
      </Theme>
    ),
  });
}
