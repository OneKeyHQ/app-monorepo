/**
 * Network Doctor - Functional API
 *
 * Provides simple functional call interface
 */

import { NetworkDoctor } from './NetworkDoctor.native';

import type { IDoctorConfig, INetworkCheckup } from './types';

/**
 * Run network diagnostics (Functional API)
 *
 * @example
 * ```typescript
 * const report = await runNetworkDoctor({
 *   targetDomain: 'wallet.onekeytest.com',
 *   healthCheckPath: '/wallet/v1/health',
 *   headersGenerator: async () => ({
 *     'Authorization': `Bearer ${token}`,
 *   }),
 *   logger: myCustomLogger,
 * });
 *
 * console.log('Assessment:', report.summary.assessment);
 * ```
 */
export async function runNetworkDoctor(
  config: IDoctorConfig,
): Promise<INetworkCheckup> {
  const diagnostics = new NetworkDoctor(config);
  return diagnostics.run();
}
