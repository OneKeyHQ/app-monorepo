// cspell:ignore pkexec

/**
 * Wire prefix used by update errors that cross the Electron IPC boundary.
 * Kept in this leaf module so both the renderer-side decoder and the
 * main-process error serializer can share it without importing the heavier
 * update-error / locale modules.
 */
export const UPDATE_ERROR_WIRE_PREFIX = 'ONEKEY_UPDATE_ERROR:';

/**
 * Main-process (sender) side of the DESKTOP_API_CALL IPC boundary: normalize
 * errors so Electron's structured clone never throws "An object could not be
 * cloned" (notably for execFile/pkexec errors on Linux/flatpak). The `.message`
 * is preserved verbatim so the renderer-side counterpart,
 * `unwrapElectronIpcError` (packages/shared/src/errors/utils/electronIpcError.ts),
 * can still recover any `{ message, code, data }` payload encoded in it.
 */
export function makeIpcSafeError(
  error: unknown,
  fallbackMessage: string,
): Error {
  if (error instanceof Error) {
    const message = error.message || fallbackMessage;
    const safeError = new Error(message);
    if (!message.startsWith(UPDATE_ERROR_WIRE_PREFIX)) {
      safeError.name = error.name || 'Error';
    }
    safeError.stack = error.stack;
    return safeError;
  }

  if (typeof error === 'string' && error) {
    return new Error(error);
  }

  return new Error(fallbackMessage);
}
