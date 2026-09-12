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
  preview: IMarketTokenDetailPreview,
): IMarketTokenDetailPreview {
  return {
    address: preview.address,
    networkId: preview.networkId,
    isNative: preview.isNative,
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
      preview: getExtensionPreviewIdentity({
        ...preview,
        isNative: identity.isNative,
      }),
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
    const preview = parseTokenDetailPreviewParam(transfer.preview);
    // Also sanitize records created by an earlier extension version.
    return preview
      ? getExtensionPreviewIdentity({ ...preview, isNative: identity.isNative })
      : undefined;
  } catch {
    return undefined;
  }
}
