import { Toast } from '@onekeyhq/components';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function toastSuccessWhenImportAddressOrPrivateKey({
  isOverrideAccounts,
  accountId,
}: {
  isOverrideAccounts: boolean;
  accountId: string;
}) {
  if (accountId) {
    if (
      isOverrideAccounts &&
      !accountUtils.isUrlAccountFn({
        accountId,
      })
    ) {
      Toast.success({
        title: appLocale.intl.formatMessage({
          id: ETranslations.feedback_wallet_exists_title,
        }),
        message: appLocale.intl.formatMessage({
          id: ETranslations.feedback_wallet_exists_desc,
        }),
      });
    } else {
      Toast.success({
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
    }
  }
}

export const toastExistingWalletSwitch = (createResult: {
  wallet: IDBWallet;
  indexedAccount: IDBIndexedAccount | undefined;
  isOverrideWallet: boolean | undefined;
  isAttachPinMode?: boolean;
}) => {
  if (createResult.wallet && createResult.isOverrideWallet) {
    setTimeout(() => {
      Toast.success({
        title: appLocale.intl.formatMessage({
          id: ETranslations.feedback_wallet_exists_title,
        }),
        message: appLocale.intl.formatMessage({
          id: createResult.isAttachPinMode
            ? ETranslations.feedback_wallet_exsited_due_to_same_pin_desc
            : ETranslations.feedback_wallet_exists_desc,
        }),
      });
    }, 1000);
  }
};
