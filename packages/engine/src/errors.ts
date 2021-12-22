/* eslint max-classes-per-file: "off" */

class OneKeyError extends Error {
  key = 'onekey_error';
}

class NotImplemented extends OneKeyError {
  key = 'onekey_error_not_implemented';
}

export { NotImplemented };
