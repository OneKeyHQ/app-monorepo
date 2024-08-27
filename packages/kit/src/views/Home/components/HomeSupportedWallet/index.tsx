import { useIntl } from 'react-intl';

import { Empty, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types/device';

import HomeSelector from '../HomeSelector';

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
    'classic': 'Classic',
    'classic1s': 'Classic 1S',
    'mini': 'Mini',
    'touch': 'Touch',
    'pro': 'Pro',
    'unknown': '',
    'watching': intl.formatMessage({
      id: ETranslations.faq_watched_account,
    }),
  };
  const items = (wallets || []).map((d) => labels[d]).filter((d) => d);
  return (
    <YStack height="100%">
      <HomeSelector createAddressDisabled padding="$5" />
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
