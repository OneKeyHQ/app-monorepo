import { type IntlShape } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { type IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  enableNotificationsBestEffort,
  isNotificationFullyEnabled,
} from '@onekeyhq/kit/src/utils/notificationPermissionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Prompt the user to enable notifications after KYT (receive risk monitoring)
// is turned on. KYT detection keeps working regardless; this only ensures the
// user can receive timely high-risk push alerts. No-op when notifications are
// already fully enabled.
export async function promptKytNotificationPermissionIfNeeded({
  navigation,
  intl,
}: {
  navigation: IAppNavigation;
  intl: IntlShape;
}): Promise<void> {
  try {
    if (await isNotificationFullyEnabled()) {
      return;
    }
  } catch {
    // Best-effort: if the notification state can't be resolved (network / IPC
    // error) we silently skip the prompt rather than letting the rejection
    // bubble into the caller's KYT-enable flow. KYT detection is unaffected and
    // the user can still enable notifications manually from settings.
    return;
  }
  Dialog.show({
    icon: 'BellOutline',
    title: intl.formatMessage({
      id: ETranslations.notifications_intro_title,
    }),
    description: intl.formatMessage({
      id: ETranslations.kyt_receive_risk_monitoring_notification_permission__desc,
    }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_enable,
    }),
    onCancelText: intl.formatMessage({
      id: ETranslations.global_later,
    }),
    onConfirm: async ({ close }) => {
      await close();
      await enableNotificationsBestEffort({ navigation });
    },
  });
}
