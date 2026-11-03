import { getLocalWalletRemoteConfig } from '../vaults/localWallet/remoteConfig';
import { getVaultSettings } from '../vaults/settings';

import type { IBackgroundApi } from '../apis/IBackgroundApi';

/** URLs the host relays may fetch: only the chain's built-in node or the user's custom node row; otherwise the relay is a fetch-anything proxy. */

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
  const targets = await loadTargets(source);
  return targets.some((target) => isUnderTarget(request, target));
}

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
    // Listed, scanning or not: public sends of a chain with privacy off still reach its node.
    getLocalWalletNetworkIds: () =>
      backgroundApi.servicePrivacyChain.getListedLocalWalletNetworkIds(),
    getNodeUrls: async (networkId) => {
      const [settings, active, customRpc] = await Promise.all([
        getVaultSettings({ networkId }),
        backgroundApi.serviceCustomRpc.resolveRpcUrlWithBuiltIn({ networkId }),
        backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(networkId),
      ]);
      // A disabled custom row still counts: a request may finish while switching back to the built-in node.
      return [
        ...(settings.builtInRpcUrls ?? []),
        ...(getLocalWalletRemoteConfig(networkId)?.nodeUrls ?? []),
        active,
        customRpc?.rpc,
      ];
    },
  };
}

export function clearPrivacyChainRelayTargetsCacheForTest() {
  cachedTargets = undefined;
  probeTargets.clear();
}
