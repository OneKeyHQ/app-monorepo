import { OneKeyAppError } from '@onekeyhq/shared/src/errors';

export type ISwapReviewWarning = {
  title: string;
  message?: string;
  toastId?: string;
};

// Main-runtime review tasks retain the business warning without showing a Toast
// until the user claims that task. Balance failures can be checked again later.
export class SwapReviewBalanceError extends OneKeyAppError {
  constructor(readonly warning: ISwapReviewWarning) {
    super(warning.title);
  }
}
