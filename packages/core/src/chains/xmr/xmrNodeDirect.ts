// cspell:ignore stagenet
import { privacyChainNodeRequest } from '@onekeyhq/core/src/utils/privacyChainNodeFetch';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

// Genesis block hashes; the Monero runtime checks nodes against the same table.
export const XMR_MAINNET_GENESIS_HASH =
  '418015bb9ae982a1975da7d79277c2705727a56894ba0fb246adaabb1f4632e3';
export const XMR_TESTNET_GENESIS_HASH =
  '48ca7cd3c8de5b6a4d53d2861fbdaedca141553559f9be9520068053cda8430b';
export const XMR_STAGENET_GENESIS_HASH =
  '76ee3cc98646292206cd3e86f74d88b4dcc1d937088645e9b0cbca84b7ce74eb';

const XMR_GENESIS_NETWORK_BY_HASH: Record<string, string> = {
  [XMR_MAINNET_GENESIS_HASH]: 'mainnet',
  [XMR_TESTNET_GENESIS_HASH]: 'testnet',
  [XMR_STAGENET_GENESIS_HASH]: 'stagenet',
};

export function xmrNetworkFromGenesisHash(hash: string): string | undefined {
  return XMR_GENESIS_NETWORK_BY_HASH[hash.toLowerCase()];
}

export function normalizeXmrNodeBase(nodeBase: string): string {
  return nodeBase.trim().replace(/\/+$/, '');
}

const XMR_NODE_DIRECT_TIMEOUT_MS = 10_000;

// Null when the node answers with an error status; a failed connection, a timeout or an oversized reply throws.
async function postXmrNode(url: string, body = ''): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    XMR_NODE_DIRECT_TIMEOUT_MS,
  );
  try {
    const response = await privacyChainNodeRequest(url, {
      method: 'POST',
      ...(body
        ? { body, headers: { 'content-type': 'application/json' } }
        : {}),
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return bufferUtils.bytesToUtf8(response.bytes);
  } finally {
    clearTimeout(timer);
  }
}

/** The top block's number, as the runtime reports its tip (`/get_height` counts blocks), without opening the scanner wallet; a failed connection throws. */
export async function fetchXmrNodeHeightDirect({
  nodeBase,
}: {
  nodeBase: string;
}): Promise<number | null> {
  const base = normalizeXmrNodeBase(nodeBase);
  const text = await postXmrNode(`${base}/get_height`);
  if (text === null) {
    return null;
  }
  try {
    const { height } = JSON.parse(text) as { height?: unknown };
    // JSON can still carry an infinite (1e400) or fractional height.
    const isBlockCount =
      typeof height === 'number' && Number.isSafeInteger(height) && height > 0;
    if (!isBlockCount) {
      return null;
    }
    return height - 1;
  } catch {
    return null;
  }
}

/** Undefined when the node's chain cannot be confirmed. */
export async function probeXmrNodeNetworkDirect({
  nodeBase,
}: {
  nodeBase: string;
}): Promise<string | undefined> {
  const base = normalizeXmrNodeBase(nodeBase);
  try {
    const text = await postXmrNode(
      `${base}/json_rpc`,
      JSON.stringify({
        jsonrpc: '2.0',
        id: '0',
        method: 'on_get_block_hash',
        params: [0],
      }),
    );
    if (text === null) {
      return undefined;
    }
    const reply = JSON.parse(text) as { result?: unknown };
    return typeof reply.result === 'string'
      ? xmrNetworkFromGenesisHash(reply.result)
      : undefined;
  } catch {
    return undefined;
  }
}
