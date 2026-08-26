import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getAddressRiskCheckPendingMessageIds } from './addressRiskCheckResultUtils';

describe('getAddressRiskCheckPendingMessageIds', () => {
  it.each([
    [
      'checking',
      { isFailed: false, isInternetReachable: false },
      {
        title: ETranslations.address_risk_check_level_checking__title,
        description: ETranslations.address_risk_check_loading__desc,
      },
    ],
    [
      'offline failure',
      { isFailed: true, isInternetReachable: false },
      {
        title: ETranslations.tray_offline_title,
        description: ETranslations.feedback_you_are_offline,
      },
    ],
    [
      'online failure',
      { isFailed: true, isInternetReachable: true },
      {
        title: ETranslations.address_risk_check_level_failed__title,
        description: ETranslations.address_risk_check_level_failed__desc,
      },
    ],
    [
      'unknown connectivity failure',
      { isFailed: true, isInternetReachable: null },
      {
        title: ETranslations.address_risk_check_level_failed__title,
        description: ETranslations.address_risk_check_level_failed__desc,
      },
    ],
  ] as const)('%s', (_name, input, expected) => {
    expect(getAddressRiskCheckPendingMessageIds(input)).toEqual(expected);
  });
});
