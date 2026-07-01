export { getWebUsbDeviceFilters } from './webDeviceFilters';

export function isWebUsbNoDeviceSelectedError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const webUsbError = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
  };

  if (webUsbError.name === 'NotFoundError' || webUsbError.code === 8) {
    return true;
  }

  return (
    typeof webUsbError.message === 'string' &&
    webUsbError.message.includes('No device selected')
  );
}
