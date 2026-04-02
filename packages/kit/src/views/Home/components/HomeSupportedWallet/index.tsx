import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import { Empty, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types/device';

type IWalletType = IOneKeyDeviceType | 'watching';

export function HomeSupportedWallet({
  supportedDeviceTypes,
  watchingAccountEnabled,
}: {
  supportedDeviceTypes?: IOneKeyDeviceType[];
  watchingAccountEnabled?: boolean;
}) {
  const intl = useIntl();
  const wallets: IWalletType[] = [];
  if (supportedDeviceTypes) {
    wallets.push(...supportedDeviceTypes);
  }
  if (watchingAccountEnabled) {
    wallets.push('watching');
  }
  const labels: Record<IWalletType, string> = {
    [EDeviceType.Classic]: 'Classic',
    [EDeviceType.Classic1s]: 'Classic 1S',
    [EDeviceType.ClassicPure]: 'Classic Pure',
    [EDeviceType.Mini]: 'Mini',
    [EDeviceType.Touch]: 'Touch',
    [EDeviceType.Pro]: 'Pro',
    [EDeviceType.Unknown]: '',
    'watching': intl.formatMessage({
      id: ETranslations.faq_watched_account,
    }),
  };
  const items = (wallets || []).map((d) => labels[d]).filter((d) => d);
  return (
    <YStack height="100%">
      <Stack flex={1} justifyContent="center">
        <Empty
          icon="GlobusOutline"
          title={intl.formatMessage(
            { id: ETranslations.selected_network_only_supports_device },
            {
              deviceType: items.join(', '),
            },
          )}
        />
      </Stack>
    </YStack>
  );
}
