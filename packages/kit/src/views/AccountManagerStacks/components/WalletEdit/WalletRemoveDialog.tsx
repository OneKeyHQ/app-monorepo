import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

export function WalletRemoveDialog({
  defaultValue,
  wallet,
  showCheckBox,
  isRemoveToMocked,
  isKeyless,
  onConfirmRemove,
}: {
  defaultValue: boolean;
  wallet?: IDBWallet;
  showCheckBox: boolean;
  isRemoveToMocked?: boolean; // hw standard wallet mocked remove only
  isKeyless?: boolean;
  onConfirmRemove?: () => void;
}) {
  const intl = useIntl();
  const [value, changeValue] = useState(defaultValue);
  const handleChange = useCallback((checked: ICheckedState) => {
    changeValue(!!checked);
  }, []);
  const actions = useAccountSelectorActions();

  // Keyless wallet always requires checkbox confirmation
  const shouldShowCheckbox = showCheckBox || isKeyless;
  const isConfirmDisabled = shouldShowCheckbox && !value;

  return (
    <>
      {shouldShowCheckbox ? (
        <Checkbox
          value={value}
          onChange={handleChange}
          label={intl.formatMessage({
            id: isKeyless
              ? ETranslations.log_out_wallet_checkbox_label
              : ETranslations.remove_wallet_double_confirm_message,
          })}
        />
      ) : null}
      <Dialog.Footer
        onConfirmText={intl.formatMessage({
          id: isKeyless
            ? ETranslations.global_logout
            : ETranslations.global_remove,
        })}
        confirmButtonProps={{
          disabled: isConfirmDisabled,
          variant: 'destructive',
        }}
        onConfirm={async () => {
          if (isKeyless) {
            await backgroundApiProxy.servicePassword.promptPasswordVerify({
              reason: EReasonForNeedPassword.Security,
            });
          }
          await actions.current.removeWallet({
            walletId: wallet?.id || '',
            isRemoveToMocked,
          });
          defaultLogger.account.wallet.deleteWallet();
          onConfirmRemove?.();
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.feedback_change_saved,
            }),
          });
        }}
      />
    </>
  );
}

export function getTitleAndDescription({
  wallet,
  isRemoveToMocked,
}: {
  wallet: IDBWallet | undefined;
  isRemoveToMocked?: boolean; // hw standard wallet mocked remove only
}): {
  isHwOrQr: boolean;
  isKeyless: boolean;
  title: string;
  description: string;
} {
  const isHwOrQr =
    accountUtils.isHwWallet({ walletId: wallet?.id }) ||
    accountUtils.isQrWallet({ walletId: wallet?.id });

  const isKeyless = wallet?.isKeyless;

  // Keyless wallet has a different description
  if (isKeyless) {
    return {
      isHwOrQr: false,
      isKeyless: true,
      title: appLocale.intl.formatMessage({ id: ETranslations.log_out_wallet }),
      description: appLocale.intl.formatMessage({
        id: ETranslations.log_out_wallet_desc,
      }),
    };
  }

  if (isHwOrQr) {
    if (
      accountUtils.isHwHiddenWallet({
        wallet,
      })
    ) {
      return {
        isHwOrQr,
        isKeyless: false,
        title: appLocale.intl.formatMessage({
          id: ETranslations.remove_wallet,
        }),
        description: appLocale.intl.formatMessage({
          id: ETranslations.remove_hidden_wallet_desc,
        }),
      };
    }
    if (!isRemoveToMocked) {
      return {
        isHwOrQr,
        isKeyless: false,
        title: appLocale.intl.formatMessage({
          id: ETranslations.remove_device,
        }),
        description: appLocale.intl.formatMessage({
          id: ETranslations.remove_device_desc,
        }),
      };
    }

    return {
      isHwOrQr,
      isKeyless: false,
      title: appLocale.intl.formatMessage({
        id: ETranslations.remove_standard_wallet,
      }),
      description: appLocale.intl.formatMessage({
        id: ETranslations.remove_standard_wallet_desc,
      }),
    };
  }

  return {
    isHwOrQr,
    isKeyless: false,
    title: appLocale.intl.formatMessage({ id: ETranslations.remove_wallet }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.remove_wallet_desc,
    }),
  };
}

export function showWalletRemoveDialog({
  title,
  description,
  defaultChecked,
  wallet,
  config,
  showCheckBox,
  isRemoveToMocked,
  isKeyless,
  onConfirmRemove,
}: {
  defaultChecked: boolean;
  title: string;
  description: string;
  wallet?: IDBWallet;
  config: IAccountSelectorContextData | undefined;
  showCheckBox: boolean;
  isRemoveToMocked?: boolean; // hw standard wallet mocked remove only
  isKeyless?: boolean;
  onConfirmRemove?: () => void;
}) {
  return Dialog.show({
    icon: 'ErrorOutline',
    tone: 'destructive',
    title,
    description,
    renderContent: config ? (
      <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
        <WalletRemoveDialog
          wallet={wallet}
          defaultValue={defaultChecked}
          showCheckBox={showCheckBox}
          isRemoveToMocked={isRemoveToMocked}
          isKeyless={isKeyless}
          onConfirmRemove={onConfirmRemove}
        />
      </AccountSelectorProviderMirror>
    ) : null,
  });
}
