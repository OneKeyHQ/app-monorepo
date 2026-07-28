import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';

type IProtocolPositionActionErrorObject = IOneKeyError & {
  $$autoToastErrorTriggered?: boolean;
  cause?: unknown;
  response?: {
    status?: unknown;
  };
};

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
}

function hasHttpResponseStatus(error: IProtocolPositionActionErrorObject) {
  return typeof error.response?.status === 'number';
}

function hasRequestMetadata(error: IProtocolPositionActionErrorObject) {
  return Boolean(error.requestId || typeof error.httpStatusCode === 'number');
}

function isOneKeyServerApiError(error: IProtocolPositionActionErrorObject) {
  return (
    error.className === EOneKeyErrorClassNames.OneKeyServerApiError ||
    error.name === EOneKeyErrorClassNames.OneKeyServerApiError
  );
}

function isLocalInlineError(error: IProtocolPositionActionErrorObject) {
  return (
    error.className === EOneKeyErrorClassNames.OneKeyLocalError ||
    error.name === EOneKeyErrorClassNames.OneKeyLocalError
  );
}

export function shouldShowProtocolPositionActionInlineSubmitError(
  error: unknown,
) {
  if (!isObjectLike(error)) {
    return false;
  }

  const oneKeyError = error as IProtocolPositionActionErrorObject;
  if (oneKeyError.autoToast || oneKeyError.$$autoToastErrorTriggered) {
    return false;
  }
  if (
    isOneKeyServerApiError(oneKeyError) ||
    hasRequestMetadata(oneKeyError) ||
    hasHttpResponseStatus(oneKeyError)
  ) {
    return false;
  }

  return isLocalInlineError(oneKeyError) && !oneKeyError.cause;
}
