import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';

import {
  FIRMWARE_ARTIFACT_TOTAL_DEADLINE_MS,
  FirmwareArtifactProvider,
  getFirmwareArtifactFailureCode,
  isRetryableFirmwareArtifactRouteFailure,
} from './FirmwareArtifactProvider';

import type {
  IFirmwareArtifactProviderDependencies,
  IFirmwareArtifactProviderStore,
} from './FirmwareArtifactProvider';
import type {
  IFirmwarePreparedArtifactReceipt,
  IFirmwareStoredArtifact,
} from './FirmwareArtifactStore';
import type {
  IFirmwareArtifactRequirement,
  IFirmwarePreparationCoreSdk,
  IFirmwarePreparedPlan,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

const createRequirement = (
  overrides: Partial<IFirmwareArtifactRequirement> = {},
): IFirmwareArtifactRequirement =>
  ({
    artifactId: 'firmware',
    role: 'firmware',
    sourceUrls: ['https://web.onekey-asset.com/firmware.bin'],
    expectedSize: 1024,
    expectedSha256: SHA_A,
    integrity: 'catalog-trusted',
    container: { kind: 'raw' },
    target: 'firmware',
    targetVersion: '1.2.3',
    devicePathRule: { kind: 'none' },
    dependsOn: [],
    ...overrides,
  }) as IFirmwareArtifactRequirement;

const createPlan = (
  artifacts: readonly IFirmwareArtifactRequirement[],
): IFirmwareUpdatePlan =>
  ({
    schemaVersion: 1,
    planId: 'plan-1',
    planDigest: SHA_A,
    manifestSnapshotDigest: SHA_B,
    manifestMode: 'external-only',
    catalogEpoch: 1,
    device: {
      identity: 'device-1',
      model: 'pro2',
      firmwareType: 'universal',
    },
    artifacts,
    epochs: [],
    expectedFinalStates: [],
  }) as IFirmwareUpdatePlan;

const createStoredArtifact = ({
  requirement,
  leaseRef = 'lease-1',
}: {
  requirement: IFirmwareArtifactRequirement;
  leaseRef?: string;
}): IFirmwareStoredArtifact => {
  const size = requirement.expectedSize ?? 0;
  const digest = requirement.expectedSha256 ?? '';
  const materialization =
    requirement.container.kind === 'archive-entry'
      ? {
          kind: 'archive-entry' as const,
          parentArtifactId: requirement.container.parentArtifactId,
          entryId: requirement.container.entryId,
        }
      : { kind: 'raw' as const };
  return {
    taskId: `task-${requirement.artifactId}`,
    requirement,
    adapterReceipt: {
      artifactRef: `ref-${requirement.artifactId}`,
      size,
      sha256: digest,
      immutableToken: `token-${requirement.artifactId}`,
    },
    preparedReceipt: {
      artifactId: requirement.artifactId,
      role: requirement.role,
      target: requirement.target,
      artifactRef: `ref-${requirement.artifactId}`,
      size,
      sha256: digest,
      integrity: requirement.integrity,
      leaseId: leaseRef,
      materialization,
    },
  };
};

const ipTableConfig: IIpTableConfigWithRuntime = {
  config: {
    version: 4,
    ttl_sec: 300,
    generated_at: '2026-07-25T00:00:00.000Z',
    domains: {
      'web.onekey-asset.com': {
        endpoints: [
          {
            ip: '203.0.113.10',
            provider: 'r2-a',
            region: 'ALL',
            weight: 50,
          },
          {
            ip: '203.0.113.11',
            provider: 'r2-b',
            region: 'ALL',
            weight: 100,
          },
          {
            ip: '203.0.113.12',
            provider: 'r2-c',
            region: 'ALL',
            weight: 25,
          },
        ],
      },
    },
    source: 'signed-remote',
    sourcePayloadHash: 'signed-config',
  },
  runtime: {
    enabled: true,
    lastUpdated: 1,
    lastRegionCheck: 1,
    selections: {
      'web.onekey-asset.com': '203.0.113.10',
    },
    lastBestIp: {
      'web.onekey-asset.com': '203.0.113.11',
    },
  },
};

const createHarness = ({
  now = () => 1000,
  getIpTableConfig = async () => ipTableConfig,
  isProxyActiveForUrl = async () => false,
}: Partial<
  Pick<
    IFirmwareArtifactProviderDependencies,
    'now' | 'getIpTableConfig' | 'isProxyActiveForUrl'
  >
> = {}) => {
  const preparedPlan = { planId: 'prepared-plan' } as IFirmwarePreparedPlan;
  const prepareFirmwareUpdate = jest.fn(
    (
      _input: Parameters<
        IFirmwarePreparationCoreSdk['prepareFirmwareUpdate']
      >[0],
    ) => preparedPlan,
  );
  const store: jest.Mocked<IFirmwareArtifactProviderStore> = {
    createLease: jest.fn(async (_transactionId: string) => 'lease-1'),
    downloadArtifact: jest.fn(async ({ leaseRef, requirement }) =>
      createStoredArtifact({ requirement, leaseRef }),
    ),
    materializeArchive: jest.fn(
      async (
        _input: Parameters<
          IFirmwareArtifactProviderStore['materializeArchive']
        >[0],
      ): Promise<IFirmwareStoredArtifact[]> => [],
    ),
  };
  const provider = new FirmwareArtifactProvider(store, {
    now,
    getIpTableConfig,
    isProxyActiveForUrl,
    loadCoreSdk: async () => ({ prepareFirmwareUpdate }),
  });
  return {
    preparedPlan,
    prepareFirmwareUpdate,
    provider,
    store,
  };
};

const nativeFailure = (code: string) =>
  Object.assign(new Error(code), {
    firmwareArtifactNativeCode: code,
  });

describe('FirmwareArtifactProvider', () => {
  it('tries exact-host selected IP, healthy candidates, then canonical domain', async () => {
    const { provider, store } = createHarness();
    store.downloadArtifact
      .mockRejectedValueOnce(nativeFailure('ARTIFACT_NETWORK_FAILED'))
      .mockRejectedValueOnce(nativeFailure('ARTIFACT_HTTP_503'))
      .mockRejectedValueOnce(nativeFailure('ARTIFACT_SHORT_BODY'))
      .mockResolvedValueOnce(
        createStoredArtifact({ requirement: createRequirement() }),
      );

    await provider.prepareArtifacts({
      transactionId: 'transaction-1',
      plan: createPlan([createRequirement()]),
    });

    expect(
      store.downloadArtifact.mock.calls.map(([input]) => input.route),
    ).toEqual([
      {
        type: 'pinnedIp',
        url: 'https://web.onekey-asset.com/firmware.bin',
        resolvedIp: '203.0.113.10',
      },
      {
        type: 'pinnedIp',
        url: 'https://web.onekey-asset.com/firmware.bin',
        resolvedIp: '203.0.113.11',
      },
      {
        type: 'pinnedIp',
        url: 'https://web.onekey-asset.com/firmware.bin',
        resolvedIp: '203.0.113.12',
      },
      {
        type: 'domain',
        url: 'https://web.onekey-asset.com/firmware.bin',
      },
    ]);
    expect(store.downloadArtifact).toHaveBeenCalledTimes(4);
    expect(
      store.downloadArtifact.mock.calls.every(
        ([input]) =>
          input.route.url === 'https://web.onekey-asset.com/firmware.bin',
      ),
    ).toBe(true);
  });

  it('uses only the canonical domain when a proxy is active or unknown', async () => {
    for (const isProxyActiveForUrl of [
      async () => true,
      async () => {
        throw new OneKeyLocalError('proxy state unavailable');
      },
    ]) {
      const { provider, store } = createHarness({ isProxyActiveForUrl });
      await provider.prepareArtifacts({
        transactionId: 'transaction-1',
        plan: createPlan([createRequirement()]),
      });
      expect(store.downloadArtifact).toHaveBeenCalledTimes(1);
      expect(store.downloadArtifact.mock.calls[0]?.[0].route).toEqual({
        type: 'domain',
        url: 'https://web.onekey-asset.com/firmware.bin',
      });
    }
  });

  it('falls back to domain when signed IP Table data is unavailable', async () => {
    const { provider, store } = createHarness({
      getIpTableConfig: async () => {
        throw new OneKeyLocalError('simple db unavailable');
      },
    });

    await provider.prepareArtifacts({
      transactionId: 'transaction-1',
      plan: createPlan([createRequirement()]),
    });

    expect(store.downloadArtifact.mock.calls[0]?.[0].route).toEqual({
      type: 'domain',
      url: 'https://web.onekey-asset.com/firmware.bin',
    });
  });

  it('resumes acquisition inside the persisted lease', async () => {
    const { provider, store } = createHarness();
    const plan = createPlan([createRequirement()]);

    const result = await provider.resumeArtifacts({
      plan,
      leaseRef: 'persisted-lease',
    });

    expect(store.createLease).not.toHaveBeenCalled();
    expect(store.downloadArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseRef: 'persisted-lease',
      }),
    );
    expect(result.leaseRef).toBe('persisted-lease');
  });

  it('fails closed on TLS, redirect, digest and size errors', async () => {
    for (const code of [
      'ARTIFACT_TLS_FAILED',
      'ARTIFACT_REDIRECT_REJECTED',
      'ARTIFACT_DIGEST_MISMATCH',
      'ARTIFACT_SIZE_MISMATCH',
      'ARTIFACT_PROTOCOL_INVALID',
    ]) {
      const { provider, store } = createHarness();
      store.downloadArtifact.mockRejectedValueOnce(nativeFailure(code));

      await expect(
        provider.prepareArtifacts({
          transactionId: 'transaction-1',
          plan: createPlan([createRequirement()]),
        }),
      ).rejects.toMatchObject({
        firmwareArtifactNativeCode: code,
      });
      expect(store.downloadArtifact).toHaveBeenCalledTimes(1);
    }
  });

  it('does not retry non-reachability HTTP failures', async () => {
    const { provider, store } = createHarness();
    store.downloadArtifact.mockRejectedValueOnce(
      nativeFailure('ARTIFACT_HTTP_404'),
    );

    await expect(
      provider.prepareArtifacts({
        transactionId: 'transaction-1',
        plan: createPlan([createRequirement()]),
      }),
    ).rejects.toMatchObject({
      firmwareArtifactNativeCode: 'ARTIFACT_HTTP_404',
    });
    expect(store.downloadArtifact).toHaveBeenCalledTimes(1);
  });

  it('enforces one wall-clock deadline across all routes', async () => {
    const times = [1000, 1000, 1000 + FIRMWARE_ARTIFACT_TOTAL_DEADLINE_MS + 1];
    const { provider, store } = createHarness({
      now: () => times.shift() ?? times.at(-1) ?? 0,
    });
    store.downloadArtifact.mockRejectedValueOnce(
      nativeFailure('ARTIFACT_NETWORK_FAILED'),
    );

    await expect(
      provider.prepareArtifacts({
        transactionId: 'transaction-1',
        plan: createPlan([createRequirement()]),
      }),
    ).rejects.toMatchObject({
      firmwareArtifactProviderCode: 'TOTAL_DEADLINE_EXCEEDED',
      artifactId: 'firmware',
    });
    expect(store.downloadArtifact).toHaveBeenCalledTimes(1);
    expect(
      store.downloadArtifact.mock.calls[0]?.[0].overallDeadlineSeconds,
    ).toBe(FIRMWARE_ARTIFACT_TOTAL_DEADLINE_MS / 1000);
  });

  it('keeps every Pro2 artifact and archive child in one lease and SDK order', async () => {
    const bootloader = createRequirement({
      artifactId: 'bootloader',
      role: 'bootloader',
      target: 'bootloader',
      expectedSha256: SHA_A,
    });
    const bundle = createRequirement({
      artifactId: 'resource-bundle',
      role: 'resource-bundle',
      target: 'resource',
      expectedSha256: SHA_B,
      container: { kind: 'archive', format: 'zip' },
    });
    const p1 = createRequirement({
      artifactId: 'p1',
      role: 'archive-entry',
      target: 'p1',
      sourceUrls: [],
      expectedSha256: SHA_C,
      container: {
        kind: 'archive-entry',
        parentArtifactId: 'resource-bundle',
        entryId: 'P1.bin',
      },
    });
    const se04 = createRequirement({
      artifactId: 'se04',
      role: 'component',
      target: 'se04',
      expectedSha256: 'd'.repeat(64),
    });
    const plan = createPlan([bootloader, bundle, p1, se04]);
    const { preparedPlan, prepareFirmwareUpdate, provider, store } =
      createHarness();
    const events: string[] = [];
    store.downloadArtifact.mockImplementation(async ({ requirement }) => {
      events.push(`download:${requirement.artifactId}`);
      return createStoredArtifact({ requirement });
    });
    store.materializeArchive.mockImplementation(async ({ entries }) => {
      events.push('materialize');
      return entries.map((requirement) =>
        createStoredArtifact({ requirement }),
      );
    });
    prepareFirmwareUpdate.mockImplementation((input) => {
      events.push('prepare');
      const artifactReceipts = (
        input as {
          artifactReceipts: readonly IFirmwarePreparedArtifactReceipt[];
        }
      ).artifactReceipts;
      expect(artifactReceipts.map((receipt) => receipt.artifactId)).toEqual([
        'bootloader',
        'resource-bundle',
        'p1',
        'se04',
      ]);
      expect(
        artifactReceipts.every((receipt) => receipt.leaseId === 'lease-1'),
      ).toBe(true);
      return preparedPlan;
    });

    const result = await provider.prepareArtifacts({
      transactionId: 'pro2-transaction',
      plan,
    });

    expect(store.createLease).toHaveBeenCalledWith('pro2-transaction');
    expect(
      store.downloadArtifact.mock.calls.map(
        ([input]) => input.requirement.artifactId,
      ),
    ).toEqual(['bootloader', 'resource-bundle', 'se04']);
    expect(store.materializeArchive).toHaveBeenCalledWith({
      leaseRef: 'lease-1',
      archive: expect.objectContaining({
        requirement: bundle,
      }),
      entries: [p1],
    });
    expect(events).toEqual([
      'download:bootloader',
      'download:resource-bundle',
      'download:se04',
      'materialize',
      'prepare',
    ]);
    expect(
      result.storedArtifacts.map(({ requirement }) => requirement.artifactId),
    ).toEqual(['bootloader', 'resource-bundle', 'p1', 'se04']);
  });

  it('does not call SDK preparation until all materialized receipts exist', async () => {
    const archive = createRequirement({
      artifactId: 'bundle',
      role: 'resource-bundle',
      target: 'resource',
      container: { kind: 'archive', format: 'zip' },
    });
    const child = createRequirement({
      artifactId: 'child',
      role: 'archive-entry',
      target: 'p2',
      sourceUrls: [],
      container: {
        kind: 'archive-entry',
        parentArtifactId: 'bundle',
        entryId: 'P2.bin',
      },
    });
    const { prepareFirmwareUpdate, provider } = createHarness();

    await expect(
      provider.prepareArtifacts({
        transactionId: 'transaction-1',
        plan: createPlan([archive, child]),
      }),
    ).rejects.toMatchObject({
      firmwareArtifactProviderCode: 'ARTIFACT_RECEIPT_MISSING',
      artifactId: 'child',
    });
    expect(prepareFirmwareUpdate).not.toHaveBeenCalled();
  });

  it('recognizes only the explicit route-retry error set', () => {
    expect(
      getFirmwareArtifactFailureCode(
        Object.assign(new Error('hidden'), {
          firmwareArtifactNativeCode: 'ARTIFACT_HTTP_503',
        }),
      ),
    ).toBe('ARTIFACT_HTTP_503');
    expect(
      isRetryableFirmwareArtifactRouteFailure(
        nativeFailure('ARTIFACT_HTTP_503'),
      ),
    ).toBe(true);
    expect(
      isRetryableFirmwareArtifactRouteFailure(
        nativeFailure('ARTIFACT_TLS_FAILED'),
      ),
    ).toBe(false);
    expect(
      isRetryableFirmwareArtifactRouteFailure(new Error('unknown failure')),
    ).toBe(false);
  });
});
