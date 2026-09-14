import { ETranslations } from '@onekeyhq/shared/src/locale';

export function getAddressRiskCheckPendingMessageIds({
  isFailed,
  isInternetReachable,
}: {
  isFailed: boolean;
  isInternetReachable?: boolean | null;
}) {
  if (isFailed && isInternetReachable === false) {
    return {
      title: ETranslations.tray_offline_title,
      description: ETranslations.feedback_you_are_offline,
    };
  }
  return isFailed
    ? {
        title: ETranslations.address_risk_check_level_failed__title,
        description: ETranslations.address_risk_check_level_failed__desc,
      }
    : {
        title: ETranslations.address_risk_check_level_checking__title,
        description: ETranslations.address_risk_check_loading__desc,
      };
}
