/* eslint max-classes-per-file: "off" */

class OneKeyError extends Error {
  key = 'onekey_error';
}

class NotImplemented extends OneKeyError {
  key = 'onekey_error_not_implemented';
}

class OneKeyInternalError extends OneKeyError {
  key = 'onekey_error_internal';
}

class WrongPassword extends OneKeyError {
  key = 'onekey_error_wrong_password';
}

class AccountAlreadyExists extends OneKeyError {
  key = 'onekey_error_account_already_exists';
}

class FailedToTransfer extends OneKeyError {
  key = 'onekey_error_failed_to_transfer';
}

export {
  NotImplemented,
  OneKeyInternalError,
  WrongPassword,
  AccountAlreadyExists,
  FailedToTransfer,
};
