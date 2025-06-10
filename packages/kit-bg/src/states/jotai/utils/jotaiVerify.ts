import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';

function ensureNotPromise<T>(value: T) {
  const valueLikePromise = value as
    | { orig: any; value: any; status: any }
    | undefined;
  if (
    valueLikePromise &&
    valueLikePromise.orig &&
    valueLikePromise.value &&
    valueLikePromise.status
  ) {
    debugger;
    throw new OneKeyPlainTextError('jotai value should not be a promise');
  }
}

export default {
  ensureNotPromise,
};
