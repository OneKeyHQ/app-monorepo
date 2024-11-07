import { Dialog, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

export const showContractWarningDialog = () =>
  new Promise((resolve, reject) => {
    Dialog.show({
      icon: 'ShieldOutline',
      tone: 'warning',
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_warning,
      }),
      renderContent: (
        <SizableText size="$bodyLg">
          {appLocale.intl.formatMessage({
            id: ETranslations.address_input_contract_popover,
          })}
        </SizableText>
      ),

      onCancel: async (close) => {
        await close();
        reject();
      },

      onConfirm: async ({ close }) => {
        await close();
        resolve(true);
      },
    });
  });
