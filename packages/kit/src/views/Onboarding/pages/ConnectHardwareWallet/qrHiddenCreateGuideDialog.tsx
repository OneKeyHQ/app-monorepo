/* eslint-disable onekey/no-app-locale-main-thread -- helper invoked from jotai actions outside React render */
import { Dialog, Stack } from '@onekeyhq/components';
import type { ITutorialsListItem } from '@onekeyhq/kit/src/components/TutorialsList';
import { TutorialsList } from '@onekeyhq/kit/src/components/TutorialsList';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

function showDialog() {
  const tutorials: ITutorialsListItem[] = [
    {
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.create_qr_based_hidden_wallet_create_standard_wallet_title,
      }),
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      description: appLocale.intl.formatMessage({
        id: ETranslations.create_qr_based_hidden_wallet_create_standard_wallet_desc,
      }),
    },
    {
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.create_qr_based_hidden_wallet_create_hidden_wallet_title,
      }),
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      description: appLocale.intl.formatMessage({
        id: ETranslations.create_qr_based_hidden_wallet_create_hidden_wallet_desc,
      }),
    },
  ];
  Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.create_qr_based_hidden_wallet_dialog_title,
    }),
    showConfirmButton: false,
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    onCancelText: appLocale.intl.formatMessage({
      id: ETranslations.global_close,
    }),
    renderContent: (
      <Stack>
        <TutorialsList tutorials={tutorials} />
      </Stack>
    ),
  });
}

function showDialogIfErrorMatched(error: IOneKeyError | unknown) {
  if (
    errorUtils.isErrorByClassName({
      error,
      className: [
        EOneKeyErrorClassNames.OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet,
      ],
    })
  ) {
    showDialog();
  }
}

function showDialogForCreatingStandardWallet({
  onConfirm,
}: {
  onConfirm: () => void;
}) {
  Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.create_qr_based_hidden_wallet_create_standard_wallet_title,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    description: appLocale.intl.formatMessage({
      id: ETranslations.create_qr_based_hidden_wallet_create_standard_wallet_desc,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_continue,
    }),
    onConfirm,
    showCancelButton: false,
  });
}

export default {
  showDialog,
  showDialogIfErrorMatched,
  showDialogForCreatingStandardWallet,
};
