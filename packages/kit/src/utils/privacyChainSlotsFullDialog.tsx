import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

// The network holds its most accounts with local data, paused ones included.
// Away from the settings page it offers that page, where one can be deleted.
export function showPrivacyChainSlotsFullDialog({
  intl,
  onOpenSettings,
}: {
  intl: IntlShape;
  onOpenSettings?: () => void;
}) {
  Dialog.show({
    title: intl.formatMessage({ id: ETranslations.privacy_slots_full__title }),
    description: intl.formatMessage({
      id: ETranslations.privacy_slots_delete__desc,
    }),
    onConfirmText: intl.formatMessage({
      id: onOpenSettings
        ? ETranslations.global_go_to_settings
        : ETranslations.global_got_it,
    }),
    showCancelButton: !!onOpenSettings,
    onConfirm: onOpenSettings,
  });
}
