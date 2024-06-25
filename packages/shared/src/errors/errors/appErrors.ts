/* eslint max-classes-per-file: "off" */

import { ETranslations } from '@onekeyhq/shared/src/locale';
// import type { LocaleKeyInfoMap } from '@onekeyhq/shared/src/localeKeyInfoMap';

import { EOneKeyErrorClassNames } from '../types/errorTypes';
import { normalizeErrorProps } from '../utils/errorUtils';

import { OneKeyError } from './baseErrors';

import type { IOneKeyError } from '../types/errorTypes';

const map = {
  hello: 'world',
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ILocaleKeyInfoMap = typeof map;

// Generic errors.
export class NotAutoPrintError extends Error {}

export class IncorrectPassword extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: IncorrectPassword',
        defaultKey: ETranslations.auth_error_password_incorrect,
      }),
    );
  }
}

export class NotImplemented extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: NotImplemented',
        defaultKey: ETranslations.send_engine_not_implemented,
      }),
    );
  }

  override className = EOneKeyErrorClassNames.OneKeyErrorNotImplemented;
}

export class OneKeyErrorAirGapAccountNotFound extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyErrorAirGapAccountNotFound',
      }),
    );
  }

  override className = EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound;
}

export class OneKeyErrorAirGapWalletMismatch extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyErrorAirGapWalletMismatch',
      }),
    );
  }

  override autoToast?: boolean | undefined = true;
}

export class OneKeyErrorAirGapInvalidQrCode extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyErrorAirGapInvalidQrCode',
      }),
    );
  }
}

export class OneKeyInternalError extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: InternalError',
        defaultKey: ETranslations.send_engine_internal_error,
      }),
    );
  }
}

export class FailedToTransfer extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FailedToTransfer',
        defaultKey: ETranslations.send_engine_failed_to_transfer,
      }),
    );
  }
}

export class WrongPassword extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WrongPassword',
        defaultKey: ETranslations.send_engine_incorrect_password,
        defaultAutoToast: true,
      }),
    );
  }
}

export class PasswordNotSet extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordNotSet',
        defaultKey: ETranslations.send_engine_password_not_set,
        defaultAutoToast: true,
      }),
    );
  }
}

export class PasswordStrengthValidationFailed extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordStrengthValidationFailed',
        defaultKey: ETranslations.send_password_validation,
      }),
    );
  }
}

export class PasswordUpdateSameFailed extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordUpdateSameFailed',
        defaultKey: ETranslations.auth_error_password_incorrect,
      }),
    );
  }
}

export class BiologyAuthFailed extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BiologyAuthFailed',
        defaultKey: ETranslations.send_verification_failure,
      }),
    );
  }
}

export class PasswordAlreadySetFailed extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordAlreadySetFaield',
        defaultKey: ETranslations.auth_error_password_incorrect,
      }),
    );
  }
}

// Simple input errors.

export class InvalidMnemonic extends OneKeyError {
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
export class MinimumBalanceRequired extends OneKeyError<IMinimumBalanceRequiredInfo> {
  constructor(props?: IOneKeyError<IMinimumBalanceRequiredInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'MimimumBalanceRequired',
        defaultKey: ETranslations.send_str_minimum_balance_is_str,
      }),
    );
  }
}

export class InvalidAddress extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidAddress',
        defaultKey: ETranslations.send_engine_incorrect_address,
      }),
    );
  }
}

export class InvalidAccount extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidAccount',
        defaultKey: ETranslations.send_engine_account_not_activated,
      }),
    );
  }
}

export class InvalidTokenAddress extends OneKeyError {
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
export class InvalidTransferValue extends OneKeyError<IInvalidTransferValueInfo> {
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
export class BalanceLowerMinimum extends OneKeyError<IBalanceLowerMinimumInfo> {
  constructor(props?: IOneKeyError<IBalanceLowerMinimumInfo> | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BalanceLowerMinimum',
        defaultKey: ETranslations.feedback_transfer_cause_balance_lower_1_dot,
      }),
    );
  }
}

export class TransferValueTooSmall extends OneKeyError {
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
export class InsufficientBalance extends OneKeyError {
  override className =
    EOneKeyErrorClassNames.OneKeyErrorInsufficientNativeBalance;

  // For situations that utxo selection failed.
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InsufficientBalance',
        defaultKey: ETranslations.send_amount_invalid,
      }),
    );
  }
}

export type IStringLengthRequirementInfo = {
  minLength: string | number;
  maxLength: string | number;
};
export class StringLengthRequirement<
  T = IStringLengthRequirementInfo,
> extends OneKeyError<T> {
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
export class AccountNameLengthError extends OneKeyError<IAccountNameLengthErrorInfo> {
  constructor(props?: IOneKeyError<IAccountNameLengthErrorInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AccountNameLengthError',
        defaultKey: ETranslations.wallet_engine_account_name_length_error,
      }),
    );
  }
}

export class WatchedAccountTradeError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WatchedAccountTradeError',
        defaultKey: ETranslations.wallet_error_trade_with_watched_acocunt,
      }),
    );
  }
}

export class AccountAlreadyExists extends OneKeyError {
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
export class NumberLimit<T = INumberLimitInfo> extends OneKeyError<T> {
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
    key: ETranslations = ETranslations.wallet_engine_ttoo_many_external_accounts,
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
export class TooManyDerivedAccounts extends OneKeyError<ITooManyDerivedAccountsInfo> {
  constructor(props?: IOneKeyError<ITooManyDerivedAccountsInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'TooManyDerivedAccounts',
        defaultKey: ETranslations.send_engine_too_many_derived_accounts,
      }),
    );
  }
}

export class OneKeyWalletConnectModalCloseError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyWalletConnectModalCloseError',
        defaultKey: ETranslations.send_engine_internal_error,
      }),
    );
  }
}

export class FailedToEstimatedGasError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FailedToEstimatedGasError',
        defaultKey: ETranslations.send_estimated_gas_failure,
      }),
    );
  }
}

export class InvalidLightningPaymentRequest extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidLightningPaymentRequest',
        defaultKey: ETranslations.send_invalid_lightning_payment_request,
      }),
    );
  }
}

export class InvoiceAlreadyPaid extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvoiceAlreadPaid',
        defaultKey: ETranslations.send_invoice_is_already_paid,
      }),
    );
  }
}

export class NoRouteFoundError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NoRouteFoundError',
        defaultKey: ETranslations.send_no_route_found,
      }),
    );
  }
}

export class ChannelInsufficientLiquidityError extends OneKeyError {
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

export class BadAuthError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BadAuthError',
        defaultKey: ETranslations.send_authentication_failed_verify_again,
      }),
    );
  }
}

export class InvoiceExpiredError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvoiceExpiredError',
        defaultKey: ETranslations.send_the_invoice_has_expired,
      }),
    );
  }
}

export class TaprootAddressError extends OneKeyError {
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

export class UtxoNotFoundError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UtxoNotFoundError',
        defaultKey: ETranslations.send_nft_does_not_exist,
      }),
    );
  }
}

export class AllNetworksMinAccountsError extends OneKeyError {
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

export class AllNetworksUpToThreeLimitsError extends OneKeyError {
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
export class InsufficientGasFee extends OneKeyError<IInsufficientGasFeeInfo> {
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
export class MinimumTransferBalanceRequiredError extends OneKeyError<IMinimumTransferBalanceRequiredErrorInfo> {
  constructor(props: IOneKeyError<IMinimumTransferBalanceRequiredErrorInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'MinimumTransferBalanceRequiredError',
        defaultKey:
          ETranslations.send_the_minimum_value_for_transffering_to_a_new_account_is_str_str,
      }),
    );
  }
}

export type IMinimumTransferBalanceRequiredForSendingAssetErrorInfo = {
  name: string;
  amount: string;
  symbol: string;
};

export class MinimumTransferBalanceRequiredForSendingAssetError extends OneKeyError<IMinimumTransferBalanceRequiredForSendingAssetErrorInfo> {
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

export class MinimumTransferAmountError extends OneKeyError<IMinimumTransferAmountErrorInfo> {
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
