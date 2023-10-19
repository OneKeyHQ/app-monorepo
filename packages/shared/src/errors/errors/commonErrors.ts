/* eslint-disable max-classes-per-file */

class IncorrectPassword extends Error {}

class NotAutoPrintError extends Error {}

class HardwareError extends Error {
  constructor(readonly payload: { error: string; code?: string }) {
    super(payload.error);
  }
}

export { IncorrectPassword, NotAutoPrintError, HardwareError };
