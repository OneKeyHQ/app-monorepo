import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

// Every sync slot is taken. Away from the settings page it offers that page,
// where another account can be turned off.
export async function showPrivacyChainSlotsFullDialog({
  intl,
  networkId,
  accountName,
  onOpenSettings,
}: {
  intl: IntlShape;
  networkId: string;
  accountName: string | undefined;
  onOpenSettings?: () => void;
}) {
  const settings = await backgroundApiProxy.serviceNetwork
    .getVaultSettings({ networkId })
    .catch(() => undefined);
  Dialog.show({
    title: intl.formatMessage({ id: ETranslations.privacy_slots_full__title }),
    description: intl.formatMessage(
      { id: ETranslations.privacy_slots_full__desc },
      { max: settings?.localWallet?.maxEnabledAccounts, accountName },
    ),
    onConfirmText: intl.formatMessage({
      id: onOpenSettings
        ? ETranslations.global_go_to_settings
        : ETranslations.global_got_it,
    }),
    showCancelButton: !!onOpenSettings,
    onConfirm: onOpenSettings,
  });
}
