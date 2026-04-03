// --- Types ---

export interface MinimumReleaseAgeConfig {
  days: number;
  allowlist: string[];
  blockOnFailure: boolean;
  registryUrl: string;
}

export interface PackageRef {
  name: string;
  version: string;
}

export type CheckStatus = 'ok' | 'too_young' | 'skipped' | 'error';

export interface CheckResult {
  status: CheckStatus;
  ageDays?: number;
  error?: string;
}

export interface NpmPackageMeta {
  time?: Record<string, string>;
}

export interface CheckDeps {
  now: Date;
  fetchMeta: (name: string, registryUrl: string) => Promise<NpmPackageMeta>;
}

// --- Default config ---

const DEFAULT_CONFIG: MinimumReleaseAgeConfig = {
  days: 7,
  allowlist: [],
  blockOnFailure: true,
  registryUrl: 'https://registry.npmjs.org',
};

// --- Functions ---

export function parseConfig(
  pkg: Record<string, unknown>,
): MinimumReleaseAgeConfig {
  const raw = pkg.minimumReleaseAge;
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CONFIG };
  }
  const cfg = raw as Record<string, unknown>;
  return {
    days: typeof cfg.days === 'number' ? cfg.days : DEFAULT_CONFIG.days,
    allowlist: Array.isArray(cfg.allowlist)
      ? (cfg.allowlist as string[])
      : DEFAULT_CONFIG.allowlist,
    blockOnFailure:
      typeof cfg.blockOnFailure === 'boolean'
        ? cfg.blockOnFailure
        : DEFAULT_CONFIG.blockOnFailure,
    registryUrl:
      typeof cfg.registryUrl === 'string'
        ? cfg.registryUrl
        : DEFAULT_CONFIG.registryUrl,
  };
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function matchesAllowlist(name: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) {
    return false;
  }
  return allowlist.some((p) => globToRegExp(p).test(name));
}

export async function checkPackageAge(
  ref: PackageRef,
  config: MinimumReleaseAgeConfig,
  deps: CheckDeps,
): Promise<CheckResult> {
  if (matchesAllowlist(ref.name, config.allowlist)) {
    return { status: 'skipped' };
  }

  try {
    const meta = await deps.fetchMeta(ref.name, config.registryUrl);

    if (!meta.time) {
      return {
        status: 'error',
        error: `No publish-time metadata found for ${ref.name}`,
      };
    }

    const publishTimeStr = meta.time[ref.version];
    if (!publishTimeStr) {
      return {
        status: 'error',
        error: `No publish time found for ${ref.name}@${ref.version}`,
      };
    }

    const publishDate = new Date(publishTimeStr);
    const ageMs = deps.now.getTime() - publishDate.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    if (ageDays < config.days) {
      return { status: 'too_young', ageDays };
    }

    return { status: 'ok', ageDays };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', error: message };
  }
}
