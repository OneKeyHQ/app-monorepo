import type { IDialogShowProps } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

export function showTonMnemonicDialog({ onConfirm }: IDialogShowProps) {
  Dialog.show({
    showExitButton: false,
    dismissOnOverlayPress: false,
    onConfirm,
    icon: 'LightBulbOutline',
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_import_ton,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_import_ton_desc,
    }),
  });
}
