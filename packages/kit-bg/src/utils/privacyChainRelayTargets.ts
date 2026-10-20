import { getVaultSettings } from '../vaults/settings';

import type { IBackgroundApi } from '../apis/IBackgroundApi';

/**
 * Which URLs the privacy-chain host relays (mobile `$private` bridge,
 * extension service worker) may fetch for the runtime.
 *
 * The relays exist so the runtime can reach nodes that serve no CORS headers;
 * without this list they are a fetch-anything proxy for whoever reaches them.
 * Only a node the app itself configured for a local-wallet chain passes: the
 * chain's built-in node or the user's custom node row. Requests go to paths
 * below that node URL (`/json_rpc`, `/get_blocks.bin`, gRPC-web methods).
 */

export type IPrivacyChainRelayTargetSource = {
  getLocalWalletNetworkIds: () => Promise<string[]>;
  getNodeUrls: (networkId: string) => Promise<Array<string | undefined>>;
};

type IRelayTarget = { protocol: string; host: string; path: string };

const TARGETS_CACHE_MS = 30 * 1000;

let cachedTargets: { at: number; targets: IRelayTarget[] } | undefined;

// A node URL the user is testing before it is saved (custom-node probe).
const probeTargets = new Map<string, { target: IRelayTarget; refs: number }>();

function parseRelayTarget(url: string): IRelayTarget | undefined {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    if (parsed.username || parsed.password) {
      return undefined;
    }
    return {
      protocol: parsed.protocol,
      // `host` drops a default port, so `:443` and no port compare equal.
      host: parsed.host,
      path: parsed.pathname.replace(/\/+$/, ''),
    };
  } catch {
    return undefined;
  }
}

function isUnderTarget(request: IRelayTarget, target: IRelayTarget) {
  return (
    request.protocol === target.protocol &&
    request.host === target.host &&
    (request.path === target.path || request.path.startsWith(`${target.path}/`))
  );
}

async function loadTargets(
  source: IPrivacyChainRelayTargetSource,
): Promise<IRelayTarget[]> {
  const targets: IRelayTarget[] = [];
  for (const networkId of await source.getLocalWalletNetworkIds()) {
    // eslint-disable-next-line no-await-in-loop
    for (const url of await source.getNodeUrls(networkId)) {
      const target = url ? parseRelayTarget(url) : undefined;
      if (target) targets.push(target);
    }
  }
  cachedTargets = { at: Date.now(), targets };
  return targets;
}

export async function isPrivacyChainRelayTargetAllowed(
  url: string,
  source: IPrivacyChainRelayTargetSource,
): Promise<boolean> {
  const request = parseRelayTarget(url);
  if (!request) return false;
  for (const { target } of probeTargets.values()) {
    if (isUnderTarget(request, target)) return true;
  }
  const fresh =
    cachedTargets && Date.now() - cachedTargets.at < TARGETS_CACHE_MS
      ? cachedTargets.targets
      : undefined;
  if (fresh?.some((target) => isUnderTarget(request, target))) return true;
  // A miss re-reads the settings: a node saved a moment ago must pass.
  const targets = await loadTargets(source);
  return targets.some((target) => isUnderTarget(request, target));
}

/** Lets the relays reach an unsaved node while the app probes it. */
export function allowPrivacyChainRelayProbe(url: string): () => void {
  const target = parseRelayTarget(url);
  if (!target) return () => undefined;
  const key = `${target.protocol}//${target.host}${target.path}`;
  const entry = probeTargets.get(key) ?? { target, refs: 0 };
  entry.refs += 1;
  probeTargets.set(key, entry);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.refs -= 1;
    if (entry.refs <= 0) probeTargets.delete(key);
  };
}

export function createPrivacyChainRelayTargetSource(
  backgroundApi: Pick<
    IBackgroundApi,
    'servicePrivacyChain' | 'serviceCustomRpc'
  >,
): IPrivacyChainRelayTargetSource {
  return {
    getLocalWalletNetworkIds: () =>
      backgroundApi.servicePrivacyChain.getLocalWalletNetworkIds(),
    getNodeUrls: async (networkId) => {
      const [settings, active, customRpc] = await Promise.all([
        getVaultSettings({ networkId }),
        backgroundApi.serviceCustomRpc.resolveRpcUrlWithBuiltIn({ networkId }),
        backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(networkId),
      ]);
      // A disabled custom row still counts: the runtime may finish a request
      // to it while switching back to the built-in node.
      return [...(settings.builtInRpcUrls ?? []), active, customRpc?.rpc];
    },
  };
}

export function clearPrivacyChainRelayTargetsCacheForTest() {
  cachedTargets = undefined;
  probeTargets.clear();
}
