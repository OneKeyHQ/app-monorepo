/* eslint max-classes-per-file: "off" */

class OneKeyError extends Error {
  info: Record<string, string>;

  key = 'onekey_error';

  constructor(message?: string, info?: Record<string, string>) {
    super(message);
    this.info = info || {};
  }
}

class NumberLimit extends OneKeyError {
  key = 'generic_number_limitation';

  constructor(limit: number) {
    super('', { limit: limit.toString() });
  }
}

class StringLengthRequirement extends OneKeyError {
  key = 'generic_string_length_requirement';

  constructor(minLength: number, maxLength: number) {
    super('', {
      minLength: minLength.toString(),
      maxLength: maxLength.toString(),
    });
  }
}

// Generic errors.

export class NotImplemented extends OneKeyError {
  key = 'msg__engine__not_implemented';
}

export class OneKeyInternalError extends OneKeyError {
  key = 'msg__engine__internal_error';
}

export class OneKeyHardwareError extends OneKeyError {
  key = 'onekey_error_hardware';
}

export class FailedToTransfer extends OneKeyError {
  key = 'msg__engine__failed_to_transfer';
}

export class WrongPassword extends OneKeyError {
  key = 'msg__engine__incorrect_password';
}

// Simple input errors.

export class InvalidMnemonic extends OneKeyError {
  key = 'msg__engine__invalid_mnemonic';
}

export class InvalidAddress extends OneKeyError {
  key = 'msg__engine__incorrect_address';
}

export class InvalidTokenAddress extends OneKeyError {
  key = 'msg__engine__incorrect_token_address';
}

export class InvalidTransferValue extends OneKeyError {
  key = 'msg__engine__incorrect_transfer_value';
}

export class WalletNameLengthError extends StringLengthRequirement {
  key = 'msg__engine__wallet_name_length_error';
}

export class AccountNameLengthError extends StringLengthRequirement {
  key = 'msg__engine__account_name_length_error';

  constructor(name: string, minLength: number, maxLength: number) {
    super(minLength, maxLength);
    this.info = { name, ...this.info };
  }
}

// Limitations.

export class AccountAlreadyExists extends OneKeyError {
  key = 'msg__engine__account_already_exists';
}

export class TooManyWatchingAccounts extends NumberLimit {
  key = 'msg__engine_too_many_watching_accounts';
}

export class TooManyHDWallets extends NumberLimit {
  key = 'msg__engine__too_many_hd_wallets';
}

export class TooManyHWWallets extends NumberLimit {
  key = 'msg__engine__too_many_hw_wallets';
}
