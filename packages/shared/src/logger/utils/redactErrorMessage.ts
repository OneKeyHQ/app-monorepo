import { scrubSensitiveErrorMessageText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

const ACCOUNT_ID_PATTERN = /\b(?:[a-z0-9_]+--)+[a-z0-9_./:@-]+\b/giu;
const BASE58_ADDRESS_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/gu;
const HEX_ADDRESS_PATTERN = /\b0x[0-9a-f]{8,}\b/giu;
const WALLET_ID_PATTERN =
  /\b(?:external|hd|hw|imported|qr|watching)-[a-z0-9_-]+\b/giu;

// Local support logs are exportable. Preserve the failure class and prose but
// remove account/address-shaped values before they reach the logger transport.
export function redactErrorMessageForLocalLog(
  errorMessage: string | undefined,
): string | undefined {
  if (!errorMessage) {
    return errorMessage;
  }
  return scrubSensitiveErrorMessageText(
    errorMessage
      .replace(ACCOUNT_ID_PATTERN, '[account-id]')
      .replace(WALLET_ID_PATTERN, '[wallet-id]')
      .replace(HEX_ADDRESS_PATTERN, '[address]')
      .replace(BASE58_ADDRESS_PATTERN, '[address]'),
  );
}
