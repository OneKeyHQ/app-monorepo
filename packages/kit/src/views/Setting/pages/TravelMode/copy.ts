import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

export function getTravelModeCopy(intl: Pick<IntlShape, 'formatMessage'>) {
  return {
    title: intl.formatMessage({ id: ETranslations.travel_mode__title }),
    disabledSwitchDescription: intl.formatMessage({
      id: ETranslations.travel_mode__wallet_ready_to_use__desc,
    }),
    enabledSwitchDescription: intl.formatMessage({
      id: ETranslations.travel_mode__wallet_information_hidden__desc,
    }),
    explanationTitle: intl.formatMessage({
      id: ETranslations.travel_mode__about__title,
    }),
    description: intl.formatMessage({
      id: ETranslations.travel_mode__overview__desc,
    }),
    details: [
      intl.formatMessage({ id: ETranslations.travel_mode__hidden_data__desc }),
      intl.formatMessage({
        id: ETranslations.travel_mode__unsaved_activity__desc,
      }),
      intl.formatMessage({
        id: ETranslations.travel_mode__paused_services__desc,
      }),
      intl.formatMessage({
        id: ETranslations.travel_mode__passcode_protection__desc,
      }),
    ],
    enabledMessage: intl.formatMessage({
      id: ETranslations.travel_mode__enabled__msg,
    }),
    enabledDescription: intl.formatMessage({
      id: ETranslations.travel_mode__enabled__desc,
    }),
    enableConfirmationTitle: intl.formatMessage({
      id: ETranslations.travel_mode__enable__title,
    }),
    enableConfirmationDescription: intl.formatMessage({
      id: ETranslations.travel_mode__empty_wallet__desc,
    }),
    enableConfirmationDetails: intl.formatMessage({
      id: ETranslations.travel_mode__confirmation_details__desc,
    }),
    enableConfirmationCancel: intl.formatMessage({
      id: ETranslations.global_not_now,
    }),
    enableConfirmationConfirm: intl.formatMessage({
      id: ETranslations.travel_mode__enable__action,
    }),
    restartingTitle: intl.formatMessage({
      id: ETranslations.travel_mode__restarting_onekey__title,
    }),
    restartingDescription: intl.formatMessage({
      id: ETranslations.travel_mode__applying_protection_mode__desc,
    }),
  };
}
