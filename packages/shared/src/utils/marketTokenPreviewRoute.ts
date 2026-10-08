import networkUtils from './networkUtils';

import type { IMarketTokenDetailPreview } from '../../types/marketV2';

export function parseTokenDetailPreviewParam(
  value: unknown,
): IMarketTokenDetailPreview | undefined {
  try {
    // Only in-memory route objects may seed the preview. URL strings are not
    // trusted token metadata, even when they contain well-formed JSON.
    const preview = value;
    if (!preview || typeof preview !== 'object' || Array.isArray(preview))
      return undefined;
    const candidate = preview as Partial<IMarketTokenDetailPreview>;
    if (
      typeof candidate.address !== 'string' ||
      typeof candidate.networkId !== 'string' ||
      typeof candidate.name !== 'string' ||
      typeof candidate.symbol !== 'string' ||
      typeof candidate.decimals !== 'number' ||
      !Number.isFinite(candidate.decimals) ||
      typeof candidate.selectedAt !== 'number' ||
      !Number.isFinite(candidate.selectedAt)
    )
      return undefined;
    return candidate as IMarketTokenDetailPreview;
  } catch {
    return undefined;
  }
}

// URL/hash navigation must fetch authoritative metadata instead of restoring
// display identity from caller-controlled query parameters.
export const marketTokenPreviewRouteConfig = {
  parse: { legacyTokenPreview: (_value: string): undefined => undefined },
  stringify: {
    legacyTokenPreview: (_value: unknown): string => '',
  },
};

const EXTENSION_PREVIEW_PREFIX = 'market-token-preview:';
const EXTENSION_PREVIEW_TTL_MS = 30 * 60 * 1000;
const EXTENSION_PREVIEW_LIMIT = 64;

type IExtensionPreviewIdentity = {
  network: string;
  tokenAddress: string;
  isNative: boolean;
};

type IExtensionPreviewTransfer = IExtensionPreviewIdentity & {
  preview: IMarketTokenDetailPreview;
  expiresAt: number;
};

// Persist identity only. A restored handoff must never replay snapshot prices
// as live data, especially on routes that cannot use the market data endpoint.
function getExtensionPreviewIdentity(
  value: unknown,
  identity: IExtensionPreviewIdentity,
): IMarketTokenDetailPreview | undefined {
  const preview = parseTokenDetailPreviewParam(value);
  if (!preview) return undefined;
  const networkId =
    networkUtils.getNetworkIdFromShortCode({ shortCode: identity.network }) ??
    identity.network;
  const previewNetworkId =
    networkUtils.getNetworkIdFromShortCode({ shortCode: preview.networkId }) ??
    preview.networkId;
  const isSameAddress = networkUtils.isEvmNetwork({ networkId })
    ? preview.address.toLowerCase() === identity.tokenAddress.toLowerCase()
    : preview.address === identity.tokenAddress;
  const previewIsNative = preview.isNative ?? preview.address.length === 0;
  if (
    !networkId ||
    previewNetworkId !== networkId ||
    !isSameAddress ||
    previewIsNative !== identity.isNative
  )
    return undefined;

  // Canonicalize only after proving equivalence. Never relabel metadata from
  // another token with the requested route identity.
  return {
    address: identity.tokenAddress,
    networkId,
    isNative: identity.isNative,
    name: preview.name,
    symbol: preview.symbol,
    decimals: preview.decimals,
    tokenImageUri: preview.tokenImageUri,
    tokenImageUris: preview.tokenImageUris,
    selectedAt: preview.selectedAt,
  };
}

// Session storage belongs to trusted extension contexts and survives bg worker
// suspension. URLs contain only an unguessable handle, never display metadata.
export async function storeExtensionTokenPreview(
  identity: IExtensionPreviewIdentity,
  preview: IMarketTokenDetailPreview,
): Promise<string | undefined> {
  try {
    const storage = globalThis.chrome?.storage?.session;
    if (
      !globalThis.chrome?.runtime?.id ||
      !storage ||
      !globalThis.crypto?.randomUUID
    )
      return undefined;
    const validatedPreview = getExtensionPreviewIdentity(preview, identity);
    if (!validatedPreview) return undefined;
    const now = Date.now();
    const entries = await storage.get(null);
    const ownedEntries = Object.entries(entries).filter(([key]) =>
      key.startsWith(EXTENSION_PREVIEW_PREFIX),
    ) as [string, IExtensionPreviewTransfer][];
    const liveEntries = ownedEntries
      .filter(([, value]) => value?.expiresAt > now)
      .toSorted((a, b) => b[1].expiresAt - a[1].expiresAt);
    const keep = new Set(
      liveEntries.slice(0, EXTENSION_PREVIEW_LIMIT - 1).map(([key]) => key),
    );
    const expiredKeys = ownedEntries
      .filter(([key]) => !keep.has(key))
      .map(([key]) => key);
    if (expiredKeys.length) await storage.remove(expiredKeys);
    const id = globalThis.crypto.randomUUID();
    const transfer: IExtensionPreviewTransfer = {
      ...identity,
      preview: validatedPreview,
      expiresAt: now + EXTENSION_PREVIEW_TTL_MS,
    };
    await storage.set({ [`${EXTENSION_PREVIEW_PREFIX}${id}`]: transfer });
    return id;
  } catch {
    return undefined;
  }
}

export async function readExtensionTokenPreview(
  id: string,
  identity: IExtensionPreviewIdentity,
): Promise<IMarketTokenDetailPreview | undefined> {
  const storage = globalThis.chrome?.storage?.session;
  if (
    !globalThis.chrome?.runtime?.id ||
    !storage ||
    !/^[a-f0-9-]{36}$/.test(id)
  )
    return undefined;
  try {
    const key = `${EXTENSION_PREVIEW_PREFIX}${id}`;
    const entries = await storage.get(key);
    const transfer = entries[key] as IExtensionPreviewTransfer | undefined;
    if (
      !transfer ||
      !Number.isFinite(transfer.expiresAt) ||
      transfer.expiresAt <= Date.now() ||
      transfer.network !== identity.network ||
      transfer.tokenAddress !== identity.tokenAddress ||
      transfer.isNative !== identity.isNative
    )
      return undefined;
    // Validate the payload too, including records from earlier versions that
    // only bound the outer envelope to the requested route.
    return getExtensionPreviewIdentity(transfer.preview, identity);
  } catch {
    return undefined;
  }
}
