import { Dialog } from '@onekeyhq/components';
import { PrivacyChainPlacesList } from '@onekeyhq/kit/src/components/PrivacyChainPlacesList';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

// The network holds its most accounts with local data, paused ones included.
// Only deleting one makes room, so they are listed here to delete on the spot.
export function showPrivacyChainSlotsFullDialog({
  intl,
  networkId,
}: {
  intl: IntlShape;
  networkId: string;
}) {
  Dialog.show({
    title: intl.formatMessage({ id: ETranslations.privacy_slots_full__title }),
    description: intl.formatMessage({
      id: ETranslations.privacy_slots_delete__desc,
    }),
    renderContent: <PrivacyChainPlacesList networkId={networkId} />,
    onConfirmText: intl.formatMessage({ id: ETranslations.global_close }),
    showCancelButton: false,
  });
}
