/**
 * Network Doctor - Functional API
 *
 * Provides simple functional call interface
 */

import { NetworkDoctor } from './NetworkDoctor.native';

import type { IDoctorConfig, INetworkCheckup } from './types';

export async function runNetworkDoctor(
  config: IDoctorConfig,
): Promise<INetworkCheckup> {
  const diagnostics = new NetworkDoctor(config);
  return diagnostics.run();
}
