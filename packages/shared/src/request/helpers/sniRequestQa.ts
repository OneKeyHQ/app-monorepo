import { OneKeyLocalError } from '../../errors';

import type {
  ISniRequestConfig,
  ISniRequestDebugSnapshot,
} from '../types/ipTable';

export type ISniRequestQaTarget = Pick<ISniRequestConfig, 'hostname' | 'ip'>;

export type ISniRequestQaAdapter = {
  transportLabel: string;
  supportsRequestIdSnapshot: boolean;
  clearDNSCache: () => Promise<{ success: boolean }>;
  getDebugSnapshot: (
    target: ISniRequestQaTarget,
  ) => Promise<ISniRequestDebugSnapshot>;
};

const unsupported = async (): Promise<never> => {
  throw new OneKeyLocalError('SNI QA transport diagnostics are unavailable');
};

export const sniRequestQaAdapter: ISniRequestQaAdapter = {
  transportLabel: 'Unsupported transport',
  supportsRequestIdSnapshot: false,
  clearDNSCache: unsupported,
  getDebugSnapshot: unsupported,
};
