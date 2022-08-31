import { Web3RpcError } from '@onekeyfe/cross-inpage-provider-errors';
/* eslint max-classes-per-file: "off" */

import { LocaleIds } from '@onekeyhq/components/src/locale';

export enum OneKeyErrorClassNames {
  OneKeyError = 'OneKeyError',
  OneKeyHardwareError = 'OneKeyHardwareError',
  OneKeyValidatorError = 'OneKeyValidatorError',
  OneKeyValidatorTip = 'OneKeyValidatorTip',
  OneKeyAbortError = 'OneKeyAbortError',
  OneKeyWalletConnectModalCloseError = 'OneKeyWalletConnectModalCloseError',
  OneKeyAlreadyExistWalletError = 'OneKeyAlreadyExistWalletError',
}

export type IOneKeyErrorInfo = Record<string | number, string | number>;

export type OneKeyHardwareErrorData = {
  reconnect?: boolean;
};

export class OneKeyError<T = Error> extends Web3RpcError<T> {
  className = OneKeyErrorClassNames.OneKeyError;

  info: IOneKeyErrorInfo;

  key = 'onekey_error';

  constructor(message?: string, info?: IOneKeyErrorInfo) {
    super(-99999, message || 'Unknown onekey internal error.');
    this.info = info || {};
  }

  override get message() {
    // TODO key message with i18n
    // @ts-ignore
    return super.message || this.key;
  }
}

class NumberLimit extends OneKeyError {
  override key = 'generic_number_limitation';

  constructor(limit: number) {
    super('', { limit: limit.toString() });
  }
}

class StringLengthRequirement extends OneKeyError {
  override key = 'generic_string_length_requirement';

  constructor(minLength: number, maxLength: number) {
    super('', {
      minLength: minLength.toString(),
      maxLength: maxLength.toString(),
    });
  }
}

// Generic errors.

export class NotImplemented extends OneKeyError {
  constructor(message?: string) {
    super(message || 'OneKeyError: NotImplemented', {});
  }

  override key = 'msg__engine__not_implemented';
}

export class OneKeyInternalError extends OneKeyError {
  override key = 'msg__engine__internal_error';
}

export class OneKeyHardwareError<
  T extends OneKeyHardwareErrorData = OneKeyHardwareErrorData,
> extends OneKeyError<T> {
  override className = OneKeyErrorClassNames.OneKeyHardwareError;

  codeHardware?: string;

  override key: LocaleIds = 'msg__hardware_default_error';

  constructor({
    message,
    code,
    info,
  }: {
    message?: string;
    code?: string;
    info?: IOneKeyErrorInfo;
  } = {}) {
    super(message, info || {});
    this.codeHardware = code;
  }
}

export class OneKeyHardwareAbortError extends OneKeyError {
  override className = OneKeyErrorClassNames.OneKeyAbortError;

  override key = 'msg__engine__internal_error';
}

export class OneKeyAlreadyExistWalletError extends OneKeyHardwareError<
  {
    walletId: string;
    accountId: string | undefined;
  } & OneKeyHardwareErrorData
> {
  override className = OneKeyErrorClassNames.OneKeyAlreadyExistWalletError;

  override key: LocaleIds = 'msg__wallet_already_exist';

  constructor(walletId: string, accountId?: string | undefined) {
    super();
    this.data = {
      walletId,
      accountId,
    };
  }
}

export class OneKeyValidatorError extends OneKeyError {
  override className = OneKeyErrorClassNames.OneKeyValidatorError;

  override key = 'onekey_error_validator';

  constructor(key: string, info?: IOneKeyErrorInfo, message?: string) {
    super(message, info);
    this.key = key;
  }
}

export class OneKeyValidatorTip extends OneKeyError {
  override className = OneKeyErrorClassNames.OneKeyValidatorTip;

  override key = 'onekey_tip_validator';

  constructor(key: string, info?: IOneKeyErrorInfo, message?: string) {
    super(message, info);
    this.key = key;
  }
}

export class FailedToTransfer extends OneKeyError {
  override key = 'msg__engine__failed_to_transfer';
}

export class WrongPassword extends OneKeyError {
  override key = 'msg__engine__incorrect_password';
}

export class PasswordStrengthValidationFailed extends OneKeyError {
  override key = 'msg__password_validation';
}

// Simple input errors.

export class InvalidMnemonic extends OneKeyError {
  override key = 'msg__engine__invalid_mnemonic';
}

export class InvalidAddress extends OneKeyError {
  override key = 'msg__engine__incorrect_address';

  constructor(message?: string, info?: IOneKeyErrorInfo) {
    super(message || 'InvalidAddress.', info);
  }
}

export class InvalidTokenAddress extends OneKeyError {
  override key = 'msg__engine__incorrect_token_address';
}

export class InvalidTransferValue extends OneKeyError {
  override key = 'msg__engine__incorrect_transfer_value';
}

export class InsufficientBalance extends OneKeyError {
  // For situations that utxo selection failed.
  override key = 'form__amount_invalid';
}

export class WalletNameLengthError extends StringLengthRequirement {
  override key = 'msg__engine__wallet_name_length_error';
}

export class AccountNameLengthError extends StringLengthRequirement {
  override key = 'msg__engine__account_name_length_error';

  constructor(name: string, minLength: number, maxLength: number) {
    super(minLength, maxLength);
    this.info = { name, ...this.info };
  }
}

// Limitations.

export class AccountAlreadyExists extends OneKeyError {
  override key = 'msg__engine__account_already_exists';
}

export class PreviousAccountIsEmpty extends OneKeyError {
  override key = 'content__previous_str_account_is_empty';

  constructor(accountTypeStr: string) {
    super('', { '0': accountTypeStr });
  }
}

export class TooManyWatchingAccounts extends NumberLimit {
  override key = 'msg__engine_too_many_watching_accounts';
}

export class TooManyExternalAccounts extends NumberLimit {
  override key = 'msg__engine_too_many_external_accounts';
}

export class TooManyImportedAccounts extends NumberLimit {
  override key = 'msg__engine__too_many_imported_accounts';
}

export class TooManyHDWallets extends NumberLimit {
  override key = 'msg__engine__too_many_hd_wallets';
}

export class TooManyHWWallets extends NumberLimit {
  override key = 'msg__engine__too_many_hw_wallets';
}

export class TooManyDerivedAccounts extends NumberLimit {
  override key = 'msg__engine__too_many_derived_accounts';

  constructor(limit: number, coinType: number, purpose: number) {
    super(limit);
    this.info = {
      coinType: coinType.toString(),
      purpose: purpose.toString(),
      ...this.info,
    };
  }
}

export class PendingQueueTooLong extends NumberLimit {
  override key = 'msg__engine__pending_queue_too_long';
}

// WalletConnect ----------------------------------------------
export class OneKeyWalletConnectModalCloseError extends OneKeyError {
  override className = OneKeyErrorClassNames.OneKeyWalletConnectModalCloseError;
  // override key = 'msg__engine__internal_error';
}
