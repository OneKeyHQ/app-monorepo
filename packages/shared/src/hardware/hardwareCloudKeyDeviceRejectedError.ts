import { OneKeyLocalError } from '../errors';

// A failure the device firmware reported (Failure_*). It carries no request or
// response data, so it is shown instead of the generic unlock error.
export class HardwareCloudKeyDeviceRejectedError extends OneKeyLocalError {
  constructor(path: string, deviceError: string) {
    super(
      /forbidden key path/i.test(deviceError)
        ? `The device rejected the derivation path ${path} (Forbidden key path). Choose another path.`
        : `The device rejected the Cloud key request: ${deviceError.slice(0, 120)}`,
    );
  }
}
