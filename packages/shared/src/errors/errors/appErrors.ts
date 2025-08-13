/* eslint max-classes-per-file: "off" */

import { ETranslations } from '@onekeyhq/shared/src/locale';
// import type { LocaleKeyInfoMap } from '@onekeyhq/shared/src/localeKeyInfoMap';

import { EOneKeyErrorClassNames } from '../types/errorTypes';
import { normalizeErrorProps } from '../utils/errorUtils';

import { OneKeyError } from './baseErrors';

import type {
  IOneKeyError,
  IOneKeyErrorI18nInfo,
  IOneKeyJsError,
} from '../types/errorTypes';

const map = {
  hello: 'world',
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ILocaleKeyInfoMap = typeof map;

// Generic errors.
export class NotAutoPrintError extends Error {}

export class OneKeyAppError<
  I18nInfoT = IOneKeyErrorI18nInfo | any,
  DataT = IOneKeyJsError | any,
> extends OneKeyError<I18nInfoT, DataT> {
  override className = EOneKeyErrorClassNames.OneKeyAppError;

  override name = EOneKeyErrorClassNames.OneKeyAppError;
}

export class IncorrectPassword extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: IncorrectPassword',
        defaultKey: ETranslations.auth_error_passcode_incorrect,
      }),
    );
  }

  override className = EOneKeyErrorClassNames.IncorrectPassword;
}

export class IncorrectMasterPassword extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: IncorrectMasterPassword',
        defaultKey: ETranslations.prime_incorrect_password,
      }),
    );
  }

  override className = EOneKeyErrorClassNames.IncorrectMasterPassword;
}

export class LocalDBRecordNotFoundError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'LocalDBRecordNotFoundError',
        // defaultKey: ETranslations.local_db_record_not_found,
      }),
    );
  }

  override className = EOneKeyErrorClassNames.LocalDBRecordNotFoundError;
}

export class TransferInvalidCodeError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'TransferInvalidCodeError',
        defaultKey: ETranslations.transfer_invalid_code,
      }),
    );
  }
}

export class RequestLimitExceededError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'RequestLimitExceededError',
        defaultKey: ETranslations.global_request_limit,
      }),
    );
  }
}

export class SystemDiskFullError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'System Disk is full',
      }),
    );
  }
}
export class NotImplemented extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: NotImplemented',
        defaultKey: ETranslations.send_engine_not_implemented,
      }),
    );
  }

  override name = EOneKeyErrorClassNames.OneKeyErrorNotImplemented;

  override className = EOneKeyErrorClassNames.OneKeyErrorNotImplemented;
}

export class OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage:
          'OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet',
      }),
    );
  }

  override name =
    EOneKeyErrorClassNames.OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet;

  override className =
    EOneKeyErrorClassNames.OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet;
}

export class OneKeyErrorAirGapAccountNotFound extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyErrorAirGapAccountNotFound',
      }),
    );
  }

  override name = EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound;

  override className = EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound;
}

export class OneKeyErrorAirGapWalletMismatch extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyErrorAirGapWalletMismatch',
        defaultKey: ETranslations.feedback_invalid_qr_code,
      }),
    );
  }

  override autoToast?: boolean | undefined = true;
}

export class OneKeyErrorAirGapInvalidQrCode extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyErrorAirGapInvalidQrCode',
        defaultKey: ETranslations.feedback_invalid_qr_code,
      }),
    );
  }
}

export class OneKeyErrorScanQrCodeCancel extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyErrorScanQrCodeCancel',
        defaultAutoToast: false,
      }),
    );
  }

  override className = EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel;

  override name = EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel;
}

export class OneKeyErrorPrimeLoginInvalidToken extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyID login invalid, please login again',
        defaultAutoToast: true,
        defaultKey: ETranslations.id_login_expired_description,
      }),
    );
  }
}

export class OneKeyErrorPrimeMasterPasswordInvalid extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'Prime master password invalid',
        defaultAutoToast: true,
      }),
    );
  }

  override className =
    EOneKeyErrorClassNames.OneKeyErrorPrimeMasterPasswordInvalid;
}

export class OneKeyErrorPrimeLoginExceedDeviceLimit extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'Prime exceed device limit',
        defaultAutoToast: true,
      }),
    );
  }
}

export class OneKeyErrorPrimePaidMembershipRequired extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        // Prime subscription is not active
        defaultMessage: 'Prime Paid membership required',
        defaultAutoToast: true,
      }),
    );
  }
}

export class OneKeyInternalError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: InternalError',
        defaultKey: ETranslations.send_engine_internal_error,
      }),
    );
  }
}

export class VaultKeyringNotDefinedError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'VaultKeyringNotDefinedError',
      }),
    );
  }

  override className = EOneKeyErrorClassNames.VaultKeyringNotDefinedError;

  override name = EOneKeyErrorClassNames.VaultKeyringNotDefinedError;
}

export class PasswordPromptDialogCancel extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordPromptDialogCancel',
        defaultKey: ETranslations.global_cancel,
      }),
    );
  }

  override className = EOneKeyErrorClassNames.PasswordPromptDialogCancel;

  override name = EOneKeyErrorClassNames.PasswordPromptDialogCancel;
}

export class PrimeLoginDialogCancelError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PrimeLoginDialogCancelError',
        defaultKey: ETranslations.global_cancel,
      }),
    );
  }

  override className = EOneKeyErrorClassNames.PrimeLoginDialogCancelError;

  override name = EOneKeyErrorClassNames.PrimeLoginDialogCancelError;
}

export class FailedToTransfer extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FailedToTransfer',
        defaultKey: ETranslations.send_engine_failed_to_transfer,
      }),
    );
  }
}

export class RenameDuplicateNameError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'RenameDuplicateNameError',
        defaultKey: ETranslations.form_rename_error_exist,
      }),
    );
  }
}

export class WrongPassword extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WrongPassword',
        defaultKey: ETranslations.send_engine_incorrect_passcode,
        defaultAutoToast: false,
      }),
    );
  }
}

export class SecureQRCodeDialogCancel extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'SecureQRCodeDialogCancel',
        defaultKey: ETranslations.global_cancel,
        defaultAutoToast: false,
      }),
    );
  }

  override className: EOneKeyErrorClassNames =
    EOneKeyErrorClassNames.SecureQRCodeDialogCancel;
}

export class PreCheckBeforeSendingCancelError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PreCheckBeforeSendingCancelError',
        defaultKey: ETranslations.global_cancel,
        defaultAutoToast: true,
      }),
    );
  }
}

export class PasswordNotSet extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordNotSet',
        defaultKey: ETranslations.send_engine_passcode_not_set,
        defaultAutoToast: true,
      }),
    );
  }
}

export class PasswordStrengthValidationFailed extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordStrengthValidationFailed',
        defaultKey: ETranslations.send_passcode_validation,
      }),
    );
  }
}

export class PasswordUpdateSameFailed extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordUpdateSameFailed',
        defaultKey: ETranslations.auth_error_passcode_incorrect,
      }),
    );
  }
}

export class BiologyAuthFailed extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BiologyAuthFailed',
        defaultKey: ETranslations.send_verification_failure,
      }),
    );
  }
}

export class PasswordAlreadySetFailed extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordAlreadySetFaield',
        defaultKey: ETranslations.auth_error_passcode_incorrect,
      }),
    );
  }
}

// Simple input errors.

export class InvalidMnemonic extends OneKeyAppError {
  // give the default constructor to ensure unittest expect.toThrow() checking passed
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidMnemonic',
        defaultKey: ETranslations.feedback_invalid_phrases,
        defaultAutoToast: true,
      }),
    );
  }
}

export type IMinimumBalanceRequiredInfo = {
  token: string;
  amount: string;
};
export class MinimumBalanceRequired extends OneKeyAppError<IMinimumBalanceRequiredInfo> {
  constructor(props?: IOneKeyError<IMinimumBalanceRequiredInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'MimimumBalanceRequired',
        defaultKey: ETranslations.send_str_minimum_balance_is_str,
      }),
    );
  }
}

export class InvalidAddress extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidAddress',
        defaultKey: ETranslations.send_engine_incorrect_address,
      }),
    );
  }
}

export class FirmwareUpdateExit extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FirmwareUpdateExit',
      }),
    );
  }

  override className = EOneKeyErrorClassNames.FirmwareUpdateExit;

  override name = EOneKeyErrorClassNames.FirmwareUpdateExit;
}

export class FirmwareUpdateTasksClear extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FirmwareUpdateTasksClear',
      }),
    );
  }

  override className = EOneKeyErrorClassNames.FirmwareUpdateTasksClear;

  override name = EOneKeyErrorClassNames.FirmwareUpdateTasksClear;
}

export class InvalidAccount extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidAccount',
        defaultKey: ETranslations.send_engine_account_not_activated,
      }),
    );
  }
}

export type INetworkFeeInsufficientInfo = {
  symbol: string;
};

export class NetworkFeeInsufficient extends OneKeyAppError<INetworkFeeInsufficientInfo> {
  constructor(props?: IOneKeyError<INetworkFeeInsufficientInfo>) {
    super(
      normalizeErrorProps(
        {
          ...props,
          info: {
            'crypto': props?.info?.symbol,
          },
        },
        {
          defaultMessage: 'NetworkFeeInsufficient',
          defaultKey:
            ETranslations.msg__str_is_required_for_network_fees_top_up_str_to_make_tx,
        },
      ),
    );
  }
}

export class InvalidTokenAddress extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidTokenAddress',
        defaultKey: ETranslations.send_engine_incorrect_token_address,
      }),
    );
  }
}

export type IInvalidTransferValueInfo = {
  amount: string;
  unit: string;
};
export class InvalidTransferValue extends OneKeyAppError<IInvalidTransferValueInfo> {
  constructor(props?: IOneKeyError<IInvalidTransferValueInfo> | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidTransferValue',
        defaultKey: ETranslations.send_engine_incorrect_transfer_value,
      }),
    );
  }
}

export type IBalanceLowerMinimumInfo = {
  amount: string;
  symbol: string;
};
export class BalanceLowerMinimum extends OneKeyAppError<IBalanceLowerMinimumInfo> {
  constructor(props?: IOneKeyError<IBalanceLowerMinimumInfo> | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BalanceLowerMinimum',
        defaultKey: ETranslations.feedback_transfer_cause_balance_lower_1_dot,
      }),
    );
  }
}

export class TransferValueTooSmall extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'TransferValueTooSmall',
        defaultKey: ETranslations.send_amount_too_small,
      }),
    );
  }
}

// **** only for Native Token  InsufficientBalance

export type IInsufficientBalanceInfo = {
  symbol: string;
};

export class InsufficientBalance extends OneKeyAppError<IInsufficientBalanceInfo> {
  override className =
    EOneKeyErrorClassNames.OneKeyErrorInsufficientNativeBalance;

  // For situations that utxo selection failed.
  constructor(props?: IOneKeyError<IInsufficientBalanceInfo>) {
    super(
      normalizeErrorProps(
        {
          ...props,
          info: {
            '0': props?.info?.symbol,
          },
        },
        {
          defaultMessage: 'InsufficientBalance',
          defaultKey: ETranslations.send_amount_invalid,
        },
      ),
    );
  }
}

export type IStringLengthRequirementInfo = {
  minLength: string | number;
  maxLength: string | number;
};
export class StringLengthRequirement<
  T = IStringLengthRequirementInfo,
> extends OneKeyAppError<T> {
  constructor(props: IOneKeyError<T>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'StringLengthRequirement',
        defaultKey: ETranslations.wallet_generic_string_length_requirement,
      }),
    );
  }
}
export class WalletNameLengthError extends StringLengthRequirement {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WalletNameLengthError',
        defaultKey: ETranslations.wallet_engine_wallet_name_length_error,
      }),
    );
  }
}

export type IAccountNameLengthErrorInfo = {
  name: string;
  minLength: number;
  maxLength: number;
};
export class AccountNameLengthError extends OneKeyAppError<IAccountNameLengthErrorInfo> {
  constructor(props?: IOneKeyError<IAccountNameLengthErrorInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AccountNameLengthError',
        defaultKey: ETranslations.wallet_engine_account_name_length_error,
      }),
    );
  }
}

export class WatchedAccountTradeError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WatchedAccountTradeError',
        defaultKey: ETranslations.wallet_error_trade_with_watched_account,
      }),
    );
  }
}

export class AccountAlreadyExists extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AccountAlreadyExists',
        defaultKey: ETranslations.wallet_engine_account_already_exists,
      }),
    );
  }
}

export type INumberLimitInfo = {
  limit: string | number;
};
export class NumberLimit<T = INumberLimitInfo> extends OneKeyAppError<T> {
  constructor({
    limit,
    key,
    defaultMessage,
  }: {
    limit: number;
    key?: ETranslations;
    defaultMessage?: string;
  }) {
    const info: INumberLimitInfo = { limit: limit.toString() };
    const keyWithDefault: ETranslations =
      key || ('generic_number_limitation' as any);
    super(
      normalizeErrorProps(
        {
          info: info as T,
          key: keyWithDefault,
        },
        {
          defaultMessage: defaultMessage ?? 'NumberLimit',
          defaultKey: keyWithDefault,
        },
      ),
    );
  }
}
export class TooManyWatchingAccounts extends NumberLimit {
  constructor(
    limit: number,
    key: ETranslations = ETranslations.wallet_engine_too_many_watching_accounts,
  ) {
    super({ limit, key, defaultMessage: 'TooManyWatchingAccounts' });
  }
}

export class TooManyExternalAccounts extends NumberLimit {
  constructor(
    limit: number,
    key: ETranslations = ETranslations.wallet_engine_too_many_external_accounts,
  ) {
    super({ limit, key, defaultMessage: 'TooManyExternalAccounts' });
  }
}

export class TooManyImportedAccounts extends NumberLimit {
  constructor(
    limit: number,
    key: ETranslations = ETranslations.wallet_engine_too_many_imported_accounts,
  ) {
    super({ limit, key, defaultMessage: 'TooManyImportedAccounts' });
  }
}

export class TooManyHDWallets extends NumberLimit {
  constructor(
    limit: number,
    key: ETranslations = ETranslations.wallet_engine_too_many_hd_wallets,
  ) {
    super({ limit, key, defaultMessage: 'TooManyHDWallets' });
  }
}

export class TooManyHWWallets extends NumberLimit {
  constructor(
    limit: number,
    key: ETranslations = ETranslations.wallet_engine_too_many_hw_wallets,
  ) {
    super({ limit, key, defaultMessage: 'TooManyHWWallets' });
  }
}

export class TooManyHWPassphraseWallets extends NumberLimit {
  constructor(
    limit: number,
    key: ETranslations = ETranslations.wallet_engine_too_many_hw_passphrase_wallets,
  ) {
    super({ limit, key, defaultMessage: 'TooManyHWPassphraseWallets' });
  }
}

export class PendingQueueTooLong extends NumberLimit {
  constructor(
    limit: number,
    key: ETranslations = ETranslations.send_engine_pending_queue_too_long,
  ) {
    super({ limit, key, defaultMessage: 'PendingQueueTooLong' });
  }
}

export type ITooManyDerivedAccountsInfo = {
  limit: string | number;
  coinType: string;
  purpose: string;
};
export class TooManyDerivedAccounts extends OneKeyAppError<ITooManyDerivedAccountsInfo> {
  constructor(props?: IOneKeyError<ITooManyDerivedAccountsInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'TooManyDerivedAccounts',
        defaultKey: ETranslations.send_engine_too_many_derived_accounts,
      }),
    );
  }
}

export class OneKeyWalletConnectModalCloseError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyWalletConnectModalCloseError',
        defaultKey: ETranslations.send_engine_internal_error,
      }),
    );
  }
}

export class FailedToEstimatedGasError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FailedToEstimatedGasError',
        defaultKey: ETranslations.send_estimated_gas_failure,
      }),
    );
  }
}

export class InvalidLightningPaymentRequest extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidLightningPaymentRequest',
        defaultKey: ETranslations.send_invalid_lightning_payment_request,
      }),
    );
  }
}

export class InvoiceAlreadyPaid extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvoiceAlreadPaid',
        defaultKey: ETranslations.send_invoice_is_already_paid,
      }),
    );
  }
}

export class NoRouteFoundError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NoRouteFoundError',
        defaultKey: ETranslations.send_no_route_found,
      }),
    );
  }
}

export class ChannelInsufficientLiquidityError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ChannelInsufficientLiquidityError',
        defaultKey:
          ETranslations.send_insufficient_liquidity_of_lightning_node_channels,
      }),
    );
  }
}

export class BadAuthError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BadAuthError',
        defaultKey: ETranslations.send_authentication_failed_verify_again,
      }),
    );
  }
}

export class InvoiceExpiredError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvoiceExpiredError',
        defaultKey: ETranslations.send_the_invoice_has_expired,
      }),
    );
  }
}

export class TaprootAddressError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'TaprootAddressError',
        defaultKey:
          ETranslations.send_invalid_address_ordinal_can_only_be_sent_to_taproot_address,
      }),
    );
  }
}

export class UtxoNotFoundError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UtxoNotFoundError',
        defaultKey: ETranslations.send_nft_does_not_exist,
      }),
    );
  }
}

export class AllNetworksMinAccountsError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AllNetworksMinAccountsError',
        defaultKey:
          ETranslations.wallet_you_need_str_accounts_on_any_network_to_create,
      }),
    );
  }
}

export class AllNetworksUpToThreeLimitsError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AllNetworksUpto3LimitsError',
        defaultKey:
          ETranslations.wallet_currently_supports_up_to_str_all_networks_accounts,
      }),
    );
  }
}

export type IInsufficientGasFeeInfo = {
  token: string;
  amount: string;
};
export class InsufficientGasFee extends OneKeyAppError<IInsufficientGasFeeInfo> {
  constructor(props: IOneKeyError<IInsufficientGasFeeInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InsufficientGasFee',
        defaultKey: ETranslations.send_suggest_reserving_str_as_gas_fee,
      }),
    );
  }
}

export type IMinimumTransferBalanceRequiredErrorInfo = {
  amount: string;
  symbol: string;
};
export class MinimumTransferBalanceRequiredError extends OneKeyAppError<IMinimumTransferBalanceRequiredErrorInfo> {
  constructor(props: IOneKeyError<IMinimumTransferBalanceRequiredErrorInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'MinimumTransferBalanceRequiredError',
        defaultKey:
          ETranslations.send_the_minimum_value_for_transferring_to_a_new_account_is_str_str,
      }),
    );
  }
}

export type IMinimumTransferBalanceRequiredForSendingAssetErrorInfo = {
  name: string;
  amount: string;
  symbol: string;
};

export class MinimumTransferBalanceRequiredForSendingAssetError extends OneKeyAppError<IMinimumTransferBalanceRequiredForSendingAssetErrorInfo> {
  constructor(
    props: IOneKeyError<IMinimumTransferBalanceRequiredForSendingAssetErrorInfo>,
  ) {
    super(
      normalizeErrorProps(
        {
          ...props,
          info: {
            '0': props.info?.name,
            '1': props.info?.amount,
            '2': props.info?.symbol,
          },
        },
        {
          defaultMessage: 'MinimumTransferBalanceRequiredForSendingAssetError',
          defaultKey:
            ETranslations.send_sending_str_requires_an_account_balance_of_at_least_str_str,
        },
      ),
    );
  }
}

export type IMinimumTransferAmountErrorInfo = {
  amount: string;
};

export class MinimumTransferAmountError extends OneKeyAppError<IMinimumTransferAmountErrorInfo> {
  constructor(props: IOneKeyError<IMinimumTransferAmountErrorInfo>) {
    super(
      normalizeErrorProps(
        {
          ...props,
          info: {
            '0': props.info?.amount,
          },
        },
        {
          defaultMessage: 'MinimumTransferAmountError',
          defaultKey: ETranslations.send_str_minimum_transfer,
        },
      ),
    );
  }
}

export type IChangeLessThanMinInputCapacityError = {
  amount: string;
};

export class AddressNotSupportSignMethodError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AddressNotSupportSignMethodError',
        defaultKey:
          ETranslations.feedback_address_type_does_not_support_sign_method,
      }),
    );
  }
}

export class LowerTransactionAmountError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'LowerTransactionAmountError',
        defaultKey: ETranslations.send_amount_invalid,
      }),
    );
  }
}

export class Expect24WordsMnemonicError extends OneKeyAppError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'Expect24WordsMnemonicError',
        defaultKey:
          ETranslations.feedback_polkadot_supported_recover_phrases_type,
      }),
    );
  }
}

export type IRemainingMinBalanceErrorInfo = {
  miniAmount: string;
};

export class RemainingMinBalanceError extends OneKeyAppError<IRemainingMinBalanceErrorInfo> {
  constructor(props?: IOneKeyError<IRemainingMinBalanceErrorInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'RemainingMinBalanceError',
        defaultKey: ETranslations.feedback_transaction_ckb_error_less,
      }),
    );
  }
}

export class ConvertTxError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ConvertTxError',
        defaultKey: ETranslations.feedback_transaction_ckb_error_convert,
      }),
    );
  }
}

export class CanNotSendZeroAmountError extends OneKeyAppError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'CanNotSendZeroAmountError',
        defaultKey: ETranslations.send_cannot_send_amount_zero,
      }),
    );
  }
}

export type IManageTokenInsufficientBalanceErrorInfo = {
  token: string;
};
export class ManageTokenInsufficientBalanceError extends OneKeyAppError<IManageTokenInsufficientBalanceErrorInfo> {
  constructor(props?: IOneKeyError<IManageTokenInsufficientBalanceErrorInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ManageTokenInsufficientBalanceError',
        defaultKey: ETranslations.manage_token_account_no_found,
      }),
    );
  }
}
