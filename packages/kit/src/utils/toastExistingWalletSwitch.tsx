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
          id: ETranslations.private_key_imported_feedback_title,
        }),
        message: appLocale.intl.formatMessage({
          id: ETranslations.private_key_imported_feedback_desc,
        }),
      });
    }
  }
}

type IWalletSwitchCreateResult = {
  wallet: IDBWallet;
  indexedAccount: IDBIndexedAccount | undefined;
  isOverrideWallet: boolean | undefined;
  isAttachPinMode?: boolean;
};

// Module-level defer lets FinalizeWalletSetup hold the toast until the user
// confirms (Enter wallet), instead of popping during the creating-wallet animation.
let isExistingWalletSwitchToastDeferred = false;
let pendingExistingWalletSwitchCreateResult: IWalletSwitchCreateResult | null =
  null;

const showExistingWalletSwitchToast = (
  createResult: IWalletSwitchCreateResult,
) => {
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
};

export const setExistingWalletSwitchToastDeferred = (deferred: boolean) => {
  isExistingWalletSwitchToastDeferred = deferred;
  if (!deferred) {
    pendingExistingWalletSwitchCreateResult = null;
  }
};

export const flushPendingExistingWalletSwitchToast = () => {
  const pending = pendingExistingWalletSwitchCreateResult;
  pendingExistingWalletSwitchCreateResult = null;
  if (pending) {
    showExistingWalletSwitchToast(pending);
  }
};

export const toastExistingWalletSwitch = (
  createResult: IWalletSwitchCreateResult,
) => {
  if (!createResult.wallet || !createResult.isOverrideWallet) {
    return;
  }
  if (isExistingWalletSwitchToastDeferred) {
    pendingExistingWalletSwitchCreateResult = createResult;
    return;
  }
  setTimeout(() => {
    showExistingWalletSwitchToast(createResult);
  }, 1000);
};
