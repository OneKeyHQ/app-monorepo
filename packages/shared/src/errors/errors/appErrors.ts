/* eslint max-classes-per-file: "off" */

import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { LocaleKeyInfoMap } from '@onekeyhq/components/src/locale/LocaleKeyInfoMap';

import { OneKeyErrorClassNames } from '../types/errorTypes';
import { normalizeErrorProps } from '../utils/errorUtils';

import { OneKeyError } from './baseErrors';

import type { IOneKeyError } from '../types/errorTypes';

// Generic errors.
export class NotImplemented extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: NotImplemented',
        defaultKey: 'msg__engine__not_implemented',
      }),
    );
  }
}

export class OneKeyInternalError extends OneKeyError {
  constructor(props?: IOneKeyError | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyError: InternalError',
        defaultKey: 'msg__engine__internal_error',
      }),
    );
  }
}

export class OneKeyValidatorError<
  K extends keyof LocaleKeyInfoMap = any,
> extends OneKeyError<LocaleKeyInfoMap[K]> {
  override className = OneKeyErrorClassNames.OneKeyValidatorError;

  constructor({
    key,
    info,
    message,
  }: {
    key: K;
    info?: LocaleKeyInfoMap[K];
    message?: string;
  }) {
    super({
      key: (key as any) || ('onekey_error_validator' as LocaleIds),
      info,
      message,
    });
  }
}

export class OneKeyValidatorTip<
  K extends keyof LocaleKeyInfoMap = any,
> extends OneKeyError<LocaleKeyInfoMap[K]> {
  override className = OneKeyErrorClassNames.OneKeyValidatorTip;

  constructor({
    key,
    info,
    message,
  }: {
    key: K;
    info?: LocaleKeyInfoMap[K];
    message?: string;
  }) {
    super({
      key: (key as any) || ('onekey_tip_validator' as LocaleIds),
      info,
      message,
    });
  }
}

export class FailedToTransfer extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FailedToTransfer',
        defaultKey: 'msg__engine__failed_to_transfer',
      }),
    );
  }
}

export class WrongPassword extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WrongPassword',
        defaultKey: 'msg__engine__incorrect_password',
      }),
    );
  }
}

export class PasswordStrengthValidationFailed extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PasswordStrengthValidationFailed',
        defaultKey: 'msg__password_validation',
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
        defaultKey: 'msg__engine__invalid_mnemonic',
      }),
    );
  }
}

export type IMimimumBalanceRequiredInfo = {
  token: string;
  amount: string;
};
export class MimimumBalanceRequired extends OneKeyError<IMimimumBalanceRequiredInfo> {
  constructor(props?: IOneKeyError<IMimimumBalanceRequiredInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'MimimumBalanceRequired',
        defaultKey: 'msg__str_minimum_balance_is_str',
      }),
    );
  }
}

export type IRecipientHasNotActivedInfo = {
  '0': string; // tokenName
};
export class RecipientHasNotActived extends OneKeyError<IRecipientHasNotActivedInfo> {
  constructor(props?: IOneKeyError<IRecipientHasNotActivedInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'RecipientHasNotActived',
        defaultKey: 'msg__recipient_hasnt_activated_str',
      }),
    );
  }
}

export class InvalidAddress extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidAddress',
        defaultKey: 'msg__engine__incorrect_address',
      }),
    );
  }
}

export type IInvalidSameAddressInfo = {
  '0': string;
};
export class InvalidSameAddress extends OneKeyError<IInvalidSameAddressInfo> {
  constructor(props?: IOneKeyError<IInvalidSameAddressInfo> | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidSameAddress',
        defaultKey: 'form__address_cannot_send_to_myself',
      }),
    );
  }
}

export class InvalidAccount extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidAccount',
        defaultKey: 'msg__engine__account_not_activated',
      }),
    );
  }
}

export class InvalidTokenAddress extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidTokenAddress',
        defaultKey: 'msg__engine__incorrect_token_address',
      }),
    );
  }
}

export type IInvalidTransferValueInfo = {
  // '0': string; // bad practice, use constructor
  amount: string;
  unit: string;
};
export class InvalidTransferValue extends OneKeyError<IInvalidTransferValueInfo> {
  constructor(props?: IOneKeyError<IInvalidTransferValueInfo> | string) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidTransferValue',
        defaultKey: 'msg__engine__incorrect_transfer_value',
      }),
    );
  }
}

export class TransferValueTooSmall extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'TransferValueTooSmall',
        defaultKey: 'msg__amount_too_small',
      }),
    );
  }
}

// **** only for Native Token  InsufficientBalance
export class InsufficientBalance extends OneKeyError {
  override className =
    OneKeyErrorClassNames.OneKeyErrorInsufficientNativeBalance;

  // For situations that utxo selection failed.
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InsufficientBalance',
        defaultKey: 'form__amount_invalid',
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
        defaultKey: 'generic_string_length_requirement' as any,
      }),
    );
  }
}
export class WalletNameLengthError extends StringLengthRequirement {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WalletNameLengthError',
        defaultKey: 'msg__engine__wallet_name_length_error',
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
        defaultKey: 'msg__engine__account_name_length_error',
      }),
    );
  }
}

export class WatchedAccountTradeError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'WatchedAccountTradeError',
        defaultKey: 'form__error_trade_with_watched_acocunt',
      }),
    );
  }
}

export class AccountAlreadyExists extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AccountAlreadyExists',
        defaultKey: 'msg__engine__account_already_exists',
      }),
    );
  }
}

export type IPreviousAccountIsEmptyInfo = {
  '0': string; // accountLabel
};
export class PreviousAccountIsEmpty extends OneKeyError<IPreviousAccountIsEmptyInfo> {
  constructor(props: IOneKeyError<IPreviousAccountIsEmptyInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'PreviousAccountIsEmpty',
        defaultKey: 'content__previous_str_account_is_empty',
      }),
    );
  }
}

export type INumberLimitInfo = {
  limit: string | number;
};
export class NumberLimit<T = INumberLimitInfo> extends OneKeyError<T> {
  constructor({ limit, key }: { limit: number; key?: LocaleIds }) {
    const info: INumberLimitInfo = { limit: limit.toString() };
    const keyWithDefault: LocaleIds =
      key || ('generic_number_limitation' as any);
    super(
      normalizeErrorProps(
        {
          info: info as T,
          key: keyWithDefault,
        },
        {
          defaultMessage: 'NumberLimit',
          defaultKey: keyWithDefault,
        },
      ),
    );
  }
}
export class TooManyWatchingAccounts extends NumberLimit {
  constructor(
    limit: number,
    key: LocaleIds = 'msg__engine_too_many_watching_accounts',
  ) {
    super({ limit, key });
  }
}

export class TooManyExternalAccounts extends NumberLimit {
  constructor(
    limit: number,
    key: LocaleIds = 'msg__engine_too_many_external_accounts',
  ) {
    super({ limit, key });
  }
}

export class TooManyImportedAccounts extends NumberLimit {
  constructor(
    limit: number,
    key: LocaleIds = 'msg__engine__too_many_imported_accounts',
  ) {
    super({ limit, key });
  }
}

export class TooManyHDWallets extends NumberLimit {
  constructor(
    limit: number,
    key: LocaleIds = 'msg__engine__too_many_hd_wallets',
  ) {
    super({ limit, key });
  }
}

export class TooManyHWWallets extends NumberLimit {
  constructor(
    limit: number,
    key: LocaleIds = 'msg__engine__too_many_hw_wallets',
  ) {
    super({ limit, key });
  }
}

export class TooManyHWPassphraseWallets extends NumberLimit {
  constructor(
    limit: number,
    key: LocaleIds = 'msg__engine__too_many_hw_passphrase_wallets' as any,
  ) {
    super({ limit, key });
  }
}

export class PendingQueueTooLong extends NumberLimit {
  constructor(
    limit: number,
    key: LocaleIds = 'msg__engine__pending_queue_too_long',
  ) {
    super({ limit, key });
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
        defaultKey: 'msg__engine__too_many_derived_accounts',
      }),
    );
  }
}

export class OneKeyWalletConnectModalCloseError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'OneKeyWalletConnectModalCloseError',
        defaultKey: 'msg__engine__internal_error',
      }),
    );
  }
}

export class FailedToEstimatedGasError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'FailedToEstimatedGasError',
        defaultKey: 'msg__estimated_gas_failure',
      }),
    );
  }
}

export class InvalidLightningPaymentRequest extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvalidLightningPaymentRequest',
        defaultKey: 'msg__invalid_lightning_payment_request',
      }),
    );
  }
}

export class InvoiceAlreadPaid extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvoiceAlreadPaid',
        defaultKey: 'msg__invoice_is_already_paid',
      }),
    );
  }
}

export class NoRouteFoundError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'NoRouteFoundError',
        defaultKey: 'msg__no_route_found',
      }),
    );
  }
}

export class ChannelInsufficientLiquidityError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ChannelInsufficientLiquidityError',
        defaultKey: 'msg__insufficient_liquidity_of_lightning_node_channels',
      }),
    );
  }
}

export class BadAuthError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'BadAuthError',
        defaultKey: 'msg__authentication_failed_verify_again',
      }),
    );
  }
}

export class InvoiceExpiredError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'InvoiceExpiredError',
        defaultKey: 'msg__the_invoice_has_expired',
      }),
    );
  }
}
export type IMaxSendAmountErrorInfo = {
  '0': number;
};
export class MaxSendAmountError extends OneKeyError<IMaxSendAmountErrorInfo> {
  constructor(props?: IOneKeyError<IMaxSendAmountErrorInfo>) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'MaxSendAmountError',
        defaultKey: 'msg__the_sending_amount_cannot_exceed_int_sats',
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
          'msg__invalid_address_ordinal_can_only_be_sent_to_taproot_address',
      }),
    );
  }
}
export type IInscribeFileTooLargeErrorInfo = {
  '0': string; // '0': '200KB'
};
export class InscribeFileTooLargeError extends OneKeyError<IInscribeFileTooLargeErrorInfo> {
  constructor(props?: IOneKeyError<IInscribeFileTooLargeErrorInfo>) {
    super(
      normalizeErrorProps(
        {
          info: { '0': '200KB' },
          ...props,
        },
        {
          defaultMessage: 'InscribeFileTooLargeError',
          defaultKey: 'msg__file_size_should_less_than_str',
        },
      ),
    );
  }
}

export class UtxoNotFoundError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'UtxoNotFoundError',
        defaultKey: 'msg__nft_does_not_exist',
      }),
    );
  }
}

export class AllNetworksMinAccountsError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AllNetworksMinAccountsError',
        defaultKey: 'msg__you_need_str_accounts_on_any_network_to_create',
      }),
    );
  }
}

export class AllNetworksUpto3LimitsError extends OneKeyError {
  constructor(props?: IOneKeyError) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'AllNetworksUpto3LimitsError',
        defaultKey: 'msg__currently_supports_up_to_str_all_networks_accounts',
      }),
    );
  }
}

export class TestAppError2 extends OneKeyError {
  override className = OneKeyErrorClassNames.OneKeyAbortError;

  // override key is bad practice, use constructor
  override key: LocaleIds = 'Handling_Fee';
}

export class TestAppError3 extends OneKeyError {
  override className = OneKeyErrorClassNames.OneKeyAbortError;

  constructor(props?: IOneKeyError | string) {
    super(normalizeErrorProps(props));
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
        // TODO use key with named parameter
        defaultKey: 'msg__suggest_reserving_str_as_gas_fee',
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
          'msg__the_minimum_value_for_transffering_to_a_new_account_is_str_str',
      }),
    );
  }
}
