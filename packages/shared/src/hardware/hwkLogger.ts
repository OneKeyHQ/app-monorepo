import { defaultLogger } from '../logger/logger';

import { sanitizeTrezorThpModuleLogData } from './trezorThpLogRedact';

// Shared logger for the hwk (third-party hardware) connectors — Trezor and
// Ledger use the same one. Connector loaders wire it into `thp.logger` /
// `transportOptions.logger`; without it the connector's logger is undefined and
// every dump is swallowed. Data is redacted before it reaches the logger.

type IHwkLogEntry = {
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: string;
  event: string;
  data?: Record<string, unknown>;
  thpModuleForwarded?: boolean;
};

export const logHwk = (entry: IHwkLogEntry) => {
  try {
    // Logs in production too: the request/response envelope (scope + event +
    // non-sensitive fields) must always be there to troubleshoot field issues.
    // Secrets (credentials, keys, raw packets, pin/passphrase) are scrubbed by
    // the sanitizer below.
    const data = sanitizeTrezorThpModuleLogData(entry.data);
    defaultLogger.hardware.sdkLog.log(
      data
        ? `[hwk:${entry.scope}] ${entry.event} ${JSON.stringify(data)}`
        : `[hwk:${entry.scope}] ${entry.event}`,
    );
  } catch {
    // logging must never break the connector
  }
};
