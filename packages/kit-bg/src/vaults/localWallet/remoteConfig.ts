import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { localWalletText } from './messages';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IVaultSettings } from '../types';

// Optional per-network settings the backend sends on a preset entry of
// /wallet/v1/network/list (`extensions.localWallet`). Each field is checked on its own;
// an invalid one is dropped and the built-in value applies.
export type ILocalWalletRemoteConfig = {
  // Default nodes, first one in use. An enabled custom node still wins.
  nodeUrls?: string[];
  // Watchdog for one scan turn.
  syncTimeoutMs?: number;
  // Upper bound on the blocks one scan step asks for; never raises the built-in size.
  maxScanBatchBlocks?: number;
  // Scanning pauses with all local data kept; private pools, balances and the
  // private receive form are hidden. Public (backend) features keep working.
  privacyDisabled?: boolean;
};

export const LOCAL_WALLET_REMOTE_NODE_URLS_MAX = 8;
export const LOCAL_WALLET_REMOTE_SYNC_TIMEOUT_MS = {
  min: 60_000,
  max: 30 * 60_000,
};
export const LOCAL_WALLET_REMOTE_SCAN_BATCH_BLOCKS = { min: 10, max: 1000 };

function isRemoteNodeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      !!parsed.hostname &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

const boundedInteger = ({ min, max }: { min: number; max: number }) =>
  z.number().int().min(min).max(max);

// Each field is checked on its own; `.catch` drops just the invalid one.
// One bad URL drops the whole list: a partial list is not what was meant.
const remoteConfigSchema = z.object({
  nodeUrls: z
    .array(z.string().max(2048).refine(isRemoteNodeUrl))
    .min(1)
    .max(LOCAL_WALLET_REMOTE_NODE_URLS_MAX)
    .optional()
    .catch(undefined),
  syncTimeoutMs: boundedInteger(LOCAL_WALLET_REMOTE_SYNC_TIMEOUT_MS)
    .optional()
    .catch(undefined),
  maxScanBatchBlocks: boundedInteger(LOCAL_WALLET_REMOTE_SCAN_BATCH_BLOCKS)
    .optional()
    .catch(undefined),
  privacyDisabled: z.literal(true).optional().catch(undefined),
});

type IServerNetworkExtension = NonNullable<
  IServerNetwork['extensions']
>[string];

// The payload is server JSON, so every field is checked at runtime despite its type.
export function parseLocalWalletRemoteConfig(
  raw: IServerNetworkExtension,
): ILocalWalletRemoteConfig | undefined {
  const parsed = remoteConfigSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const { nodeUrls, syncTimeoutMs, maxScanBatchBlocks, privacyDisabled } =
    parsed.data;
  const config: ILocalWalletRemoteConfig = {
    ...(nodeUrls ? { nodeUrls: Array.from(new Set(nodeUrls)) } : {}),
    ...(syncTimeoutMs === undefined ? {} : { syncTimeoutMs }),
    ...(maxScanBatchBlocks === undefined ? {} : { maxScanBatchBlocks }),
    ...(privacyDisabled ? { privacyDisabled } : {}),
  };
  return Object.keys(config).length ? config : undefined;
}

export function parseLocalWalletRemoteConfigs(
  raw: Record<string, ILocalWalletRemoteConfig> | null | undefined,
): Record<string, ILocalWalletRemoteConfig> {
  const configs: Record<string, ILocalWalletRemoteConfig> = {};
  for (const [networkId, value] of Object.entries(raw ?? {})) {
    const config = parseLocalWalletRemoteConfig(value);
    if (config) configs[networkId] = config;
  }
  return configs;
}

// Mirrors the persisted server state for synchronous readers in vault code;
// ServiceCustomRpc fills it on every read of that state and after each fetch.
let remoteConfigByNetworkId: Record<string, ILocalWalletRemoteConfig> = {};

export function setLocalWalletRemoteConfigs(
  configs: Record<string, ILocalWalletRemoteConfig>,
): void {
  remoteConfigByNetworkId = parseLocalWalletRemoteConfigs(configs);
}

export function getLocalWalletRemoteConfig(
  networkId: string,
): ILocalWalletRemoteConfig | undefined {
  return remoteConfigByNetworkId[networkId];
}

export function isLocalWalletPrivacyDisabled(networkId: string): boolean {
  return remoteConfigByNetworkId[networkId]?.privacyDisabled === true;
}

// Recheck at transaction stage boundaries: stored account intent stays unchanged.
export function assertLocalWalletPrivacyEnabled(networkId: string): void {
  if (isLocalWalletPrivacyDisabled(networkId)) {
    throw new OneKeyLocalError({
      message: localWalletText(ETranslations.global_not_available),
      autoToast: true,
    });
  }
}

export async function ensureLocalWalletPrivacyAvailable({
  backgroundApi,
  networkId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
}): Promise<void> {
  await backgroundApi.serviceCustomRpc.ensureLocalWalletRemoteConfigLoaded();
  assertLocalWalletPrivacyEnabled(networkId);
}

export function listPrivacyDisabledNetworkIds(): string[] {
  return Object.keys(remoteConfigByNetworkId).filter(
    isLocalWalletPrivacyDisabled,
  );
}

export function capLocalWalletScanBatch(
  networkId: string,
  builtInBlocks: number,
): number {
  const cap = remoteConfigByNetworkId[networkId]?.maxScanBatchBlocks;
  return cap === undefined ? builtInBlocks : Math.min(builtInBlocks, cap);
}

// Keeps a backend pool for display when privacy is off remotely. A chain
// without one (Monero) keeps its pool; only its scanning pauses.
export function hideLocalWalletPrivatePools(
  settings: IVaultSettings,
): IVaultSettings {
  const { localWallet } = settings;
  const publicPools =
    localWallet?.pools.filter((pool) => pool.source === 'backend') ?? [];
  if (!localWallet || publicPools.length === 0) return settings;
  return Object.freeze<IVaultSettings>({
    ...settings,
    localWallet: {
      ...localWallet,
      balanceShape: 'single',
      pools: publicPools,
      historyOnlyPools: undefined,
    },
  });
}
