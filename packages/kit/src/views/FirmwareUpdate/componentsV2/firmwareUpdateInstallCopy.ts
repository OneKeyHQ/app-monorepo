import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  IFirmwareUpdateStage,
  IRemainingTimeBucket,
} from './firmwareUpdateInstallViewModel';
import type { IntlShape } from 'react-intl';

/**
 * Copy of the install page that is computed from state (stage words, time
 * buckets, the title with the model name). Plain keys are formatted inline
 * where they render.
 */
export const firmwareUpdateInstallCopy = {
  updatingDevice: (intl: IntlShape, deviceName: string) =>
    intl.formatMessage(
      { id: ETranslations.firmware_update_updating_device__title },
      { device: deviceName },
    ),
  stage: (intl: IntlShape, stage: IFirmwareUpdateStage): string => {
    switch (stage) {
      case 'preparing':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_preparing__msg,
        });
      case 'downloading':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_downloading__msg,
        });
      case 'enteringUpdateMode':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_entering_update_mode__msg,
        });
      case 'waitingForDevice':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_waiting_for_device__msg,
        });
      case 'installing':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_installing__msg,
        });
      case 'verifying':
      default:
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_verifying__msg,
        });
    }
  },
  /** Right side of the progress row: "74%" or "74% · About 1 min left". */
  progressMeta: (percent: number, remainingTimeText?: string) =>
    remainingTimeText
      ? `${Math.round(percent)}% · ${remainingTimeText}`
      : `${Math.round(percent)}%`,
  remainingTime: (intl: IntlShape, bucket: IRemainingTimeBucket): string => {
    if (bucket.kind === 'minutes') {
      return intl.formatMessage(
        { id: ETranslations.firmware_update_time_left_about_min__msg },
        { count: bucket.minutes },
      );
    }
    if (bucket.kind === 'oneMinute') {
      return intl.formatMessage({
        id: ETranslations.firmware_update_time_left_about_one_min__msg,
      });
    }
    return intl.formatMessage({
      id: ETranslations.firmware_update_time_left_under_one_min__msg,
    });
  },
};
