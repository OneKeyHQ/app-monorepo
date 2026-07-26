import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { isProxyActiveForUrl } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';
import { getOrderedIpTableCandidates } from '@onekeyhq/shared/src/utils/ipTableUtils';

import type {
  FirmwareArtifactStore,
  IFirmwareArtifactRoute,
  IFirmwareStoredArtifact,
} from './FirmwareArtifactStore';
import type {
  IFirmwareArtifactRequirement,
  IFirmwarePreparationCoreSdk,
  IFirmwarePreparedPlan,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';

export const FIRMWARE_ARTIFACT_TOTAL_DEADLINE_MS = 30 * 60 * 1000;
export const FIRMWARE_ARTIFACT_MAX_IP_CANDIDATES = 3;

const RETRYABLE_ARTIFACT_CODES = new Set([
  'ARTIFACT_NETWORK_FAILED',
  'ARTIFACT_SHORT_BODY',
  'ARTIFACT_WORKER_STOP_TIMEOUT',
]);

export type EFirmwareArtifactProviderErrorCode =
  | 'INVALID_PLAN'
  | 'TOTAL_DEADLINE_EXCEEDED'
  | 'ROUTES_EXHAUSTED'
  | 'ARTIFACT_RECEIPT_MISSING';

export type IFirmwareArtifactProviderError = OneKeyLocalError & {
  firmwareArtifactProviderCode: EFirmwareArtifactProviderErrorCode;
  artifactId?: string;
  lastRouteErrorCode?: string;
};

export type IFirmwareArtifactProviderStore = Pick<
  FirmwareArtifactStore,
  'createLease' | 'downloadArtifact' | 'materializeArchive'
>;

export type IFirmwareArtifactProviderDependencies = {
  now: () => number;
  loadCoreSdk: () => Promise<IFirmwarePreparationCoreSdk>;
  getIpTableConfig: () => Promise<IIpTableConfigWithRuntime | null>;
  isProxyActiveForUrl: (url: string) => Promise<boolean | null>;
};

export type IFirmwareArtifactPreparationResult = {
  leaseRef: string;
  storedArtifacts: readonly IFirmwareStoredArtifact[];
  preparedPlan: IFirmwarePreparedPlan;
};

export type IFirmwareArtifactPreparationLifecycle = {
  onLeaseCreated?: (leaseRef: string) => Promise<void>;
  onArtifactReady?: (
    artifact: IFirmwareStoredArtifact,
    telemetry?: IFirmwareArtifactLifecycleTelemetry,
  ) => Promise<void>;
  onMaterializationStarted?: () => Promise<void>;
};

export type IFirmwareArtifactLifecycleTelemetry = {
  phase: 'acquisition' | 'materialization';
  routeType: IFirmwareArtifactRoute['type'];
  candidateIndex: number;
  durationMs: number;
  bytesReused: number;
  resumeKind: 'none' | 'range' | 'segments';
  resumeCount: number;
};

const DEFAULT_DEPENDENCIES: IFirmwareArtifactProviderDependencies = {
  now: () => Date.now(),
  loadCoreSdk: CoreSDKLoader,
  getIpTableConfig: () => requestHelper.getFirmwareArtifactIpTableConfig(),
  isProxyActiveForUrl,
};

const createProviderError = ({
  code,
  message,
  artifactId,
  lastRouteErrorCode,
  cause,
}: {
  code: EFirmwareArtifactProviderErrorCode;
  message: string;
  artifactId?: string;
  lastRouteErrorCode?: string;
  cause?: unknown;
}): IFirmwareArtifactProviderError =>
  Object.assign(new OneKeyLocalError(message), {
    firmwareArtifactProviderCode: code,
    ...(artifactId ? { artifactId } : {}),
    ...(lastRouteErrorCode ? { lastRouteErrorCode } : {}),
    ...(cause === undefined ? {} : { cause }),
  });

const fail = (input: Parameters<typeof createProviderError>[0]): never => {
  throw createProviderError(input);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getFirmwareArtifactFailureCode = (
  error: unknown,
): string | undefined => {
  if (isRecord(error)) {
    for (const key of [
      'firmwareArtifactNativeCode',
      'firmwareArtifactStoreCode',
      'errorCode',
      'code',
    ]) {
      const value = error[key];
      if (
        typeof value === 'string' &&
        /^(?:ARTIFACT|SNI)_[A-Z0-9_]+$/u.test(value)
      ) {
        return value;
      }
    }
  }
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }
  return message.match(/\b(?:ARTIFACT|SNI)_[A-Z0-9_]+\b/u)?.[0];
};

export const isRetryableFirmwareArtifactRouteFailure = (
  error: unknown,
): boolean => {
  const code = getFirmwareArtifactFailureCode(error);
  if (!code) {
    return false;
  }
  if (RETRYABLE_ARTIFACT_CODES.has(code)) {
    return true;
  }
  const status = /^ARTIFACT_HTTP_(\d{3})$/u.exec(code)?.[1];
  if (!status) {
    return false;
  }
  const statusCode = Number(status);
  return (
    statusCode === 408 ||
    statusCode === 416 ||
    statusCode === 429 ||
    (statusCode >= 500 && statusCode <= 599)
  );
};

const parseSourceUrl = (
  requirement: IFirmwareArtifactRequirement,
  sourceUrl: string,
): URL => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return fail({
      code: 'INVALID_PLAN',
      artifactId: requirement.artifactId,
      message: `Artifact ${requirement.artifactId} has an invalid source URL`,
    });
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    return fail({
      code: 'INVALID_PLAN',
      artifactId: requirement.artifactId,
      message: `Artifact ${requirement.artifactId} requires a canonical HTTPS source`,
    });
  }
  return parsed;
};

const getRemainingDeadlineSeconds = ({
  now,
  deadlineAt,
  artifactId,
}: {
  now: number;
  deadlineAt: number;
  artifactId: string;
}): number => {
  const remainingMs = deadlineAt - now;
  if (remainingMs <= 0) {
    return fail({
      code: 'TOTAL_DEADLINE_EXCEEDED',
      artifactId,
      message: `Artifact ${artifactId} exceeded the shared acquisition deadline`,
    });
  }
  return remainingMs / 1000;
};

export class FirmwareArtifactProvider {
  private readonly dependencies: IFirmwareArtifactProviderDependencies;

  constructor(
    private readonly store: IFirmwareArtifactProviderStore,
    dependencies: Partial<IFirmwareArtifactProviderDependencies> = {},
  ) {
    this.dependencies = {
      ...DEFAULT_DEPENDENCIES,
      ...dependencies,
    };
  }

  private async getRoutes({
    requirement,
    configWithRuntime,
  }: {
    requirement: IFirmwareArtifactRequirement;
    configWithRuntime: IIpTableConfigWithRuntime | null;
  }): Promise<IFirmwareArtifactRoute[]> {
    const routes: IFirmwareArtifactRoute[] = [];
    for (const sourceUrl of requirement.sourceUrls) {
      const parsed = parseSourceUrl(requirement, sourceUrl);
      let proxyStateKnownInactive = false;
      try {
        proxyStateKnownInactive =
          (await this.dependencies.isProxyActiveForUrl(sourceUrl)) === false;
      } catch {
        proxyStateKnownInactive = false;
      }
      if (proxyStateKnownInactive && configWithRuntime) {
        const candidates = getOrderedIpTableCandidates({
          hostname: parsed.hostname,
          configWithRuntime,
          exactHostOnly: true,
          maxCandidates: FIRMWARE_ARTIFACT_MAX_IP_CANDIDATES,
        });
        candidates.forEach((resolvedIp) => {
          routes.push({
            type: 'pinnedIp',
            url: sourceUrl,
            resolvedIp,
          });
        });
      }
      routes.push({
        type: 'domain',
        url: sourceUrl,
      });
    }
    return routes;
  }

  private async acquireArtifact({
    leaseRef,
    requirement,
    configWithRuntime,
    deadlineAt,
  }: {
    leaseRef: string;
    requirement: IFirmwareArtifactRequirement;
    configWithRuntime: IIpTableConfigWithRuntime | null;
    deadlineAt: number;
  }): Promise<{
    stored: IFirmwareStoredArtifact;
    telemetry: IFirmwareArtifactLifecycleTelemetry;
  }> {
    const routes = await this.getRoutes({ requirement, configWithRuntime });
    let lastError: unknown;
    for (const [candidateIndex, route] of routes.entries()) {
      const startedAt = this.dependencies.now();
      const remainingSeconds = getRemainingDeadlineSeconds({
        now: startedAt,
        deadlineAt,
        artifactId: requirement.artifactId,
      });
      try {
        const stored = await this.store.downloadArtifact({
          leaseRef,
          requirement,
          route,
          overallDeadlineSeconds: remainingSeconds,
        });
        return {
          stored,
          telemetry: {
            phase: 'acquisition',
            routeType: route.type,
            candidateIndex,
            durationMs: Math.max(
              0,
              Math.round(this.dependencies.now() - startedAt),
            ),
            bytesReused: stored.acquisition?.bytesReused ?? 0,
            resumeKind: stored.acquisition?.resumeKind ?? 'none',
            resumeCount: stored.acquisition?.resumeCount ?? 0,
          },
        };
      } catch (error) {
        if (!isRetryableFirmwareArtifactRouteFailure(error)) {
          throw error;
        }
        lastError = error;
      }
    }
    return fail({
      code: 'ROUTES_EXHAUSTED',
      artifactId: requirement.artifactId,
      lastRouteErrorCode: getFirmwareArtifactFailureCode(lastError),
      cause: lastError,
      message: `All acquisition routes failed for artifact ${requirement.artifactId}`,
    });
  }

  async prepareArtifacts({
    transactionId,
    plan,
    lifecycle,
  }: {
    transactionId: string;
    plan: IFirmwareUpdatePlan;
    lifecycle?: IFirmwareArtifactPreparationLifecycle;
  }): Promise<IFirmwareArtifactPreparationResult> {
    const leaseRef = await this.store.createLease(transactionId);
    await lifecycle?.onLeaseCreated?.(leaseRef);
    return this.prepareArtifactsWithLease({
      plan,
      leaseRef,
      lifecycle,
    });
  }

  async resumeArtifacts({
    plan,
    leaseRef,
    lifecycle,
  }: {
    plan: IFirmwareUpdatePlan;
    leaseRef: string;
    lifecycle?: IFirmwareArtifactPreparationLifecycle;
  }): Promise<IFirmwareArtifactPreparationResult> {
    return this.prepareArtifactsWithLease({
      plan,
      leaseRef,
      lifecycle,
    });
  }

  private async prepareArtifactsWithLease({
    plan,
    leaseRef,
    lifecycle,
  }: {
    plan: IFirmwareUpdatePlan;
    leaseRef: string;
    lifecycle?: IFirmwareArtifactPreparationLifecycle;
  }): Promise<IFirmwareArtifactPreparationResult> {
    const deadlineAt =
      this.dependencies.now() + FIRMWARE_ARTIFACT_TOTAL_DEADLINE_MS;
    let configWithRuntime: IIpTableConfigWithRuntime | null = null;
    try {
      configWithRuntime = await this.dependencies.getIpTableConfig();
    } catch {
      configWithRuntime = null;
    }

    const storedByArtifactId = new Map<string, IFirmwareStoredArtifact>();
    const telemetryByArtifactId = new Map<
      string,
      IFirmwareArtifactLifecycleTelemetry
    >();
    for (const requirement of plan.artifacts) {
      if (requirement.container.kind !== 'archive-entry') {
        const { stored, telemetry } = await this.acquireArtifact({
          leaseRef,
          requirement,
          configWithRuntime,
          deadlineAt,
        });
        storedByArtifactId.set(requirement.artifactId, stored);
        telemetryByArtifactId.set(requirement.artifactId, telemetry);
        await lifecycle?.onArtifactReady?.(stored, telemetry);
      }
    }

    if (
      plan.artifacts.some(
        (requirement) => requirement.container.kind === 'archive',
      )
    ) {
      await lifecycle?.onMaterializationStarted?.();
    }
    for (const requirement of plan.artifacts) {
      if (requirement.container.kind === 'archive') {
        const archive = storedByArtifactId.get(requirement.artifactId);
        if (!archive) {
          return fail({
            code: 'ARTIFACT_RECEIPT_MISSING',
            artifactId: requirement.artifactId,
            message: `Archive ${requirement.artifactId} has no verified receipt`,
          });
        }
        const entries = plan.artifacts.filter(
          (candidate) =>
            candidate.container.kind === 'archive-entry' &&
            candidate.container.parentArtifactId === requirement.artifactId,
        );
        const materializationStartedAt = this.dependencies.now();
        const materialized = await this.store.materializeArchive({
          leaseRef,
          archive,
          entries,
        });
        materialized.forEach((stored) => {
          storedByArtifactId.set(stored.requirement.artifactId, stored);
        });
        const parentTelemetry = telemetryByArtifactId.get(
          requirement.artifactId,
        );
        for (const stored of materialized) {
          const telemetry: IFirmwareArtifactLifecycleTelemetry = {
            phase: 'materialization',
            routeType: parentTelemetry?.routeType ?? 'domain',
            candidateIndex: parentTelemetry?.candidateIndex ?? 0,
            durationMs: Math.max(
              0,
              Math.round(this.dependencies.now() - materializationStartedAt),
            ),
            bytesReused: parentTelemetry?.bytesReused ?? 0,
            resumeKind: parentTelemetry?.resumeKind ?? 'none',
            resumeCount: parentTelemetry?.resumeCount ?? 0,
          };
          telemetryByArtifactId.set(stored.requirement.artifactId, telemetry);
          await lifecycle?.onArtifactReady?.(stored, telemetry);
        }
      }
    }

    const storedArtifacts = plan.artifacts.map((requirement) => {
      const stored = storedByArtifactId.get(requirement.artifactId);
      if (!stored) {
        return fail({
          code: 'ARTIFACT_RECEIPT_MISSING',
          artifactId: requirement.artifactId,
          message: `Artifact ${requirement.artifactId} has no verified receipt`,
        });
      }
      return stored;
    });
    const coreSdk = await this.dependencies.loadCoreSdk();
    const preparedPlan = coreSdk.prepareFirmwareUpdate({
      plan,
      artifactReceipts: storedArtifacts.map(
        ({ preparedReceipt }) => preparedReceipt,
      ),
    });
    return {
      leaseRef,
      storedArtifacts,
      preparedPlan,
    };
  }
}
