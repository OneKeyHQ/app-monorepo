/**
 * Network Doctor - Universal Entry
 *
 * This file provides type-safe stubs for non-native platforms.
 * For native implementation, use index.native.ts
 *
 * IMPORTANT: Network Doctor is only available on native platforms (iOS/Android).
 * On web/desktop/extension platforms, calling these functions will throw runtime errors.
 */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IDoctorConfig, INetworkCheckup } from './types';

export * from './types';
export * from './config';

/**
 * Network Doctor Class (Stub for non-native platforms)
 * @throws {OneKeyLocalError} Always throws error on non-native platforms
 */
export class NetworkDoctor {
  constructor(_config: IDoctorConfig) {
    throw new OneKeyLocalError(
      'NetworkDoctor is only available on native platforms (iOS/Android). ' +
        'This functionality requires native modules that are not available on web/desktop/extension.',
    );
  }

  async run(): Promise<INetworkCheckup> {
    throw new OneKeyLocalError(
      'NetworkDoctor is only available on native platforms (iOS/Android).',
    );
  }
}

/**
 * Run network diagnostics (Stub for non-native platforms)
 * @throws {OneKeyLocalError} Always throws error on non-native platforms
 */
export async function runNetworkDoctor(
  _config: IDoctorConfig,
): Promise<INetworkCheckup> {
  throw new OneKeyLocalError(
    'NetworkDoctor is only available on native platforms (iOS/Android). ' +
      'This functionality requires native modules that are not available on web/desktop/extension.',
  );
}
