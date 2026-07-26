import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const LEDGER_RELAY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,256}$/;
const LEDGER_RELAY_PATH_PREFIX = '/v1/ledger/session/';
const MAX_LEDGER_RELAY_URL_LENGTH = 2048;

export function assertLedgerAttestationRelayUrl(params: {
  relayUrl: string;
  rebateEndpoint: string;
}): void {
  if (
    !params.relayUrl ||
    params.relayUrl.length > MAX_LEDGER_RELAY_URL_LENGTH
  ) {
    throw new OneKeyLocalError('Invalid Ledger attestation relay URL');
  }

  let relay: URL;
  let rebate: URL;
  try {
    relay = new URL(params.relayUrl);
    rebate = new URL(params.rebateEndpoint);
  } catch {
    throw new OneKeyLocalError('Invalid Ledger attestation relay URL');
  }

  const rebateHostParts = rebate.hostname.split('.');
  if (rebateHostParts.length < 2) {
    throw new OneKeyLocalError('Invalid Ledger attestation relay policy');
  }
  const expectedHostname = ['attestation', ...rebateHostParts.slice(1)].join(
    '.',
  );
  const expectedPort = rebate.port;
  const token = relay.pathname.startsWith(LEDGER_RELAY_PATH_PREFIX)
    ? relay.pathname.slice(LEDGER_RELAY_PATH_PREFIX.length)
    : '';

  if (
    relay.protocol !== 'wss:' ||
    relay.hostname !== expectedHostname ||
    relay.port !== expectedPort ||
    relay.username ||
    relay.password ||
    relay.search ||
    relay.hash ||
    !LEDGER_RELAY_TOKEN_PATTERN.test(token)
  ) {
    throw new OneKeyLocalError('Ledger attestation relay is not allowed');
  }
}
