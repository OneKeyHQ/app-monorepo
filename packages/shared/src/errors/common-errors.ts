// eslint-disable-next-line max-classes-per-file
class NotImplementedError extends Error {}

class IncorrectPassword extends Error {}

class InvalidMnemonic extends Error {}

class NotAutoPrintError extends Error {}

class HardwareError extends Error {
  constructor(readonly payload: { error: string; code?: string }) {
    super(payload.error);
  }
}

export {
  NotImplementedError,
  IncorrectPassword,
  InvalidMnemonic,
  NotAutoPrintError,
  HardwareError,
};
