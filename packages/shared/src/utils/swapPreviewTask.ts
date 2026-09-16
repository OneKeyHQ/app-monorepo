import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '../errors/types/errorTypes';
import {
  isRequestCanceledError,
  toPlainErrorObject,
} from '../errors/utils/errorUtils';

export type ISwapPreviewTaskResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: Partial<IOneKeyError> };

// Return failures as data so background RPC does not display speculative errors
// or strip their business details on split-runtime platforms.
export async function runSwapPreviewTask<T>(
  task: () => Promise<T>,
): Promise<ISwapPreviewTaskResult<T>> {
  try {
    return { ok: true, result: await task() };
  } catch (error) {
    const plainError = toPlainErrorObject(error);
    return {
      ok: false,
      error: {
        ...plainError,
        message:
          typeof error === 'string'
            ? error
            : String(plainError.message ?? 'Unknown error'),
        ...(isRequestCanceledError(error)
          ? { className: EOneKeyErrorClassNames.AxiosAbortCancelError }
          : {}),
        $$autoToastErrorTriggered: (error as IOneKeyError | undefined)
          ?.$$autoToastErrorTriggered,
      },
    };
  }
}

export async function unwrapSwapPreviewTask<T>(
  task: Promise<ISwapPreviewTaskResult<T>>,
): Promise<T> {
  const result = await task;
  if (!result.ok) {
    throw Object.assign(new Error(result.error.message), result.error);
  }
  return result.result;
}
