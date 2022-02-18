/* eslint max-classes-per-file: "off" */

class OneKeyError extends Error {
  key = 'onekey_error';
}

class NotImplemented extends OneKeyError {
  key = 'msg__engine__not_implemented';
}

class OneKeyInternalError extends OneKeyError {
  key = 'msg__engine__internal_error';
}

class WrongPassword extends OneKeyError {
  key = 'msg__engine__incorrect_password';
}

class AccountAlreadyExists extends OneKeyError {
  key = 'msg__engine__account_already_exists';
}

class FailedToTransfer extends OneKeyError {
  key = 'msg__engine__failed_to_transfer';
}

class InvalidAddress extends OneKeyError {
  key = 'msg__engine__incorrect_address';
}

export {
  NotImplemented,
  OneKeyInternalError,
  WrongPassword,
  AccountAlreadyExists,
  FailedToTransfer,
  InvalidAddress,
};
